import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
} from "@nestjs/common";
import {
    ApiBearerAuth,
    ApiOperation,
    ApiPropertyOptional,
    ApiQuery,
    ApiTags,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsBoolean,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from "class-validator";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
import { JobStatus } from "../analysis/entities/analysis-job.entity";
import { AdminService } from "./admin.service";
import { AnalysisService } from "../analysis/analysis.service";
import { CorrectionsService } from "../corrections/corrections.service";
import { CorrectionField, CorrectionStatus } from "../corrections/entities/correction.entity";
import { ModelsService } from "../models/models.service";

class PageQuery {
    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ default: 25 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    pageSize?: number;
}

class UsersQuery extends PageQuery {
    @ApiPropertyOptional({ description: "Search by e-mail (substring)" })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    search?: string;
}

class JobsQuery extends PageQuery {
    @ApiPropertyOptional({ enum: JobStatus })
    @IsOptional()
    @IsEnum(JobStatus)
    status?: JobStatus;
}

class CorrectionsQuery extends PageQuery {
    @ApiPropertyOptional({ enum: CorrectionStatus })
    @IsOptional()
    @IsEnum(CorrectionStatus)
    status?: CorrectionStatus;

    @ApiPropertyOptional({ enum: CorrectionField })
    @IsOptional()
    @IsEnum(CorrectionField)
    field?: CorrectionField;
}

class UpdateUserDto {
    @ApiPropertyOptional({ enum: UserRole })
    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;

    @ApiPropertyOptional({ minimum: 0, maximum: 100000 })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100000)
    monthlyAnalysisLimit?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isBlocked?: boolean;
}

class UpdateCorrectionDto {
    @ApiPropertyOptional({ enum: CorrectionStatus })
    @IsEnum(CorrectionStatus)
    status!: CorrectionStatus;
}

@ApiTags("admin")
@ApiBearerAuth()
@Roles(UserRole.Admin)
@Controller("admin")
export class AdminController {
    constructor(
        private readonly adminService: AdminService,
        private readonly analysisService: AnalysisService,
        private readonly correctionsService: CorrectionsService,
        private readonly modelsService: ModelsService
    ) {}

    // ── Users ────────────────────────────────────────────────────────────────

    @Get("users")
    @ApiOperation({ summary: "List users with e-mail search" })
    listUsers(@Query() q: UsersQuery) {
        return this.adminService.listUsers(q.search, q.page ?? 1, q.pageSize ?? 25);
    }

    @Patch("users/:id")
    @ApiOperation({ summary: "Change role, monthly limit or blocked state" })
    updateUser(
        @CurrentUser() actor: AuthenticatedUser,
        @Param("id", ParseUUIDPipe) id: string,
        @Body() dto: UpdateUserDto
    ) {
        return this.adminService.updateUser(actor.id, id, dto);
    }

    // ── Queue ────────────────────────────────────────────────────────────────

    @Get("queue")
    @ApiOperation({ summary: "Number of analysis jobs per status" })
    queue() {
        return this.adminService.queueCounts();
    }

    @Get("jobs")
    @ApiOperation({ summary: "List analysis jobs (e.g. ?status=failed with error text)" })
    jobs(@Query() q: JobsQuery) {
        return this.adminService.listJobs(q.status, q.page ?? 1, q.pageSize ?? 25);
    }

    @Post("jobs/:id/retry")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Re-queue a failed job" })
    retry(@Param("id", ParseUUIDPipe) id: string) {
        return this.analysisService.retry(id);
    }

    @Post("jobs/retry-failed")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Re-queue all failed jobs that still have their audio fragment" })
    retryAll() {
        return this.adminService.retryAllFailed();
    }

    // ── Statistics ───────────────────────────────────────────────────────────

    @Get("stats")
    @ApiOperation({
        summary: "Service statistics: users, analyses per day, cache ratio, timing, genres",
    })
    @ApiQuery({ name: "days", required: false, example: 14 })
    stats(@Query("days") days?: string) {
        const n = Math.min(Math.max(parseInt(days ?? "14", 10) || 14, 1), 365);
        return this.adminService.stats(n);
    }

    // ── Corrections & model ──────────────────────────────────────────────────

    @Get("corrections")
    @ApiOperation({ summary: "User corrections of genre / mood" })
    corrections(@Query() q: CorrectionsQuery) {
        return this.correctionsService.list({
            status: q.status,
            field: q.field,
            page: q.page ?? 1,
            pageSize: q.pageSize ?? 25,
        });
    }

    @Patch("corrections/:id")
    @ApiOperation({ summary: "Approve (use for training) or reject a correction" })
    updateCorrection(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateCorrectionDto) {
        return this.correctionsService.setStatus(id, dto.status);
    }

    @Get("models")
    @ApiOperation({ summary: "Genre-model versions with test-set metrics" })
    models() {
        return this.modelsService.list();
    }

    @Post("models/train")
    @ApiOperation({ summary: "Retrain the genre model on approved corrections" })
    train() {
        return this.modelsService.train();
    }

    @Post("models/:id/activate")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: "Activate a version (only if its metrics are not worse than the active one)",
    })
    activate(@Param("id", ParseUUIDPipe) id: string) {
        return this.modelsService.activate(id);
    }
}
