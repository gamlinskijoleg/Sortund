import {
    BadRequestException,
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    UploadedFile,
    UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
    ApiBearerAuth,
    ApiBody,
    ApiConsumes,
    ApiOperation,
    ApiProperty,
    ApiPropertyOptional,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsInt,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { AnalysisService, MAX_FRAGMENT_BYTES } from "./analysis.service";

class EnqueueDto {
    @ApiProperty({ description: "Track identifier on the device (media library asset id)" })
    @IsString()
    @MaxLength(255)
    trackId!: string;

    @ApiPropertyOptional({ description: "Original file name; defaults to the uploaded name" })
    @IsOptional()
    @IsString()
    @MaxLength(512)
    filename?: string;

    @ApiPropertyOptional({ description: "Skip the cache and run the models again" })
    @IsOptional()
    @Transform(({ value }) => value === true || value === "true" || value === "1")
    @IsBoolean()
    force?: boolean;
}

class SimilarDto {
    @ApiProperty()
    @IsString()
    @MaxLength(128)
    fingerprint!: string;

    @ApiProperty({ type: [String], description: "Fingerprints of the user's library to rank" })
    @IsArray()
    @ArrayMaxSize(20000)
    @IsString({ each: true })
    candidates!: string[];

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;
}

@ApiTags("analysis")
@ApiBearerAuth()
@Controller("analysis")
export class AnalysisController {
    constructor(private readonly analysisService: AnalysisService) {}

    @Post("jobs")
    @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_FRAGMENT_BYTES } }))
    @ApiConsumes("multipart/form-data")
    @ApiOperation({ summary: "Queue a track fragment (≤ 30 s) for analysis" })
    @ApiBody({
        schema: {
            type: "object",
            required: ["file", "trackId"],
            properties: {
                file: { type: "string", format: "binary" },
                trackId: { type: "string" },
                filename: { type: "string" },
                force: { type: "boolean" },
            },
        },
    })
    @ApiResponse({ status: 201, description: "Job queued" })
    @ApiResponse({ status: 403, description: "Monthly limit reached (code LIMIT_EXCEEDED)" })
    enqueue(
        @CurrentUser() user: AuthenticatedUser,
        @UploadedFile() file: Express.Multer.File | undefined,
        @Body() dto: EnqueueDto
    ) {
        if (!file) throw new BadRequestException("file is required");
        return this.analysisService.enqueue(user.id, {
            trackId: dto.trackId,
            filename: dto.filename || file.originalname || "track.mp3",
            payload: file.buffer,
            force: dto.force ?? false,
        });
    }

    @Get("jobs")
    @ApiOperation({ summary: "Status (and results) of jobs; without ids returns the latest jobs" })
    @ApiQuery({ name: "ids", required: false, description: "Comma-separated job ids (max 200)" })
    getJobs(@CurrentUser() user: AuthenticatedUser, @Query("ids") ids?: string) {
        if (!ids) return this.analysisService.recentJobs(user.id);
        const list = ids
            .split(",")
            .map((s) => s.trim())
            .filter((s) => /^[0-9a-f-]{36}$/i.test(s))
            .slice(0, 200);
        return this.analysisService.getJobs(user.id, list);
    }

    @Post("jobs/:id/retry")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Re-queue a failed job" })
    retry(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
        return this.analysisService.retry(id, user.id);
    }

    @Get("usage")
    @ApiOperation({ summary: "Analyses used this month and the remaining limit" })
    usage(@CurrentUser() user: AuthenticatedUser) {
        return this.analysisService.usage(user.id);
    }

    @Get("model")
    @ApiOperation({ summary: "Active genre-model version" })
    model() {
        return this.analysisService.modelInfo();
    }

    @Post("similar")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Rank the user's tracks by audio similarity to the given track" })
    similar(@Body() dto: SimilarDto) {
        return this.analysisService.similar(dto.fingerprint, dto.candidates, dto.limit ?? 20);
    }
}
