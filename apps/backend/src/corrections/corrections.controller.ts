import { Body, Controller, Post } from "@nestjs/common";
import {
    ApiBearerAuth,
    ApiOperation,
    ApiProperty,
    ApiPropertyOptional,
    ApiTags,
} from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { CorrectionsService } from "./corrections.service";
import { CorrectionField } from "./entities/correction.entity";

class CreateCorrectionDto {
    @ApiProperty({ description: "Acoustic fingerprint of the track (from the analysis result)" })
    @IsString()
    @MaxLength(128)
    fingerprint!: string;

    @ApiProperty({ enum: CorrectionField })
    @IsEnum(CorrectionField)
    field!: CorrectionField;

    @ApiPropertyOptional({ nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(128)
    oldValue?: string | null;

    @ApiProperty()
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    newValue!: string;
}

@ApiTags("corrections")
@ApiBearerAuth()
@Controller("corrections")
export class CorrectionsController {
    constructor(private readonly correctionsService: CorrectionsService) {}

    @Post()
    @ApiOperation({ summary: "Report a manual genre / mood fix (used to retrain the model)" })
    async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCorrectionDto) {
        const saved = await this.correctionsService.create(user.id, dto);
        return { id: saved.id, status: saved.status };
    }
}
