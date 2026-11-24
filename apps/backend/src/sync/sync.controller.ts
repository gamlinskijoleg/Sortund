import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import {
    ApiBearerAuth,
    ApiOperation,
    ApiProperty,
    ApiPropertyOptional,
    ApiTags,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
    ValidateNested,
} from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { SyncService } from "./sync.service";

class SyncItemDto {
    @ApiProperty({
        description: "Track fingerprint, or 'meta:<artist>|<title>' for unanalysed tracks",
    })
    @IsString()
    @MaxLength(255)
    key!: string;

    @ApiProperty({ type: Object, description: "Manual edits, own tags, favourite flag" })
    @IsObject()
    data!: Record<string, unknown>;

    @ApiProperty({ description: "Client modification time, ms since epoch" })
    @IsInt()
    @Min(0)
    updatedAt!: number;
}

class SyncPlaylistDto {
    @ApiProperty()
    @IsUUID()
    id!: string;

    @ApiProperty({ type: Object })
    @IsObject()
    data!: Record<string, unknown>;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    deleted?: boolean;

    @ApiProperty()
    @IsInt()
    @Min(0)
    updatedAt!: number;
}

class SyncDto {
    @ApiProperty({ type: [SyncItemDto] })
    @IsArray()
    @ArrayMaxSize(20000)
    @ValidateNested({ each: true })
    @Type(() => SyncItemDto)
    items!: SyncItemDto[];

    @ApiProperty({ type: [SyncPlaylistDto] })
    @IsArray()
    @ArrayMaxSize(2000)
    @ValidateNested({ each: true })
    @Type(() => SyncPlaylistDto)
    playlists!: SyncPlaylistDto[];

    @ApiPropertyOptional({ description: "serverTime of the previous sync; 0 = full download" })
    @IsOptional()
    @IsInt()
    @Min(0)
    since?: number;
}

@ApiTags("sync")
@ApiBearerAuth()
@Controller("sync")
export class SyncController {
    constructor(private readonly syncService: SyncService) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary:
            "Back up library data and receive newer changes from other devices (last write wins)",
    })
    sync(@CurrentUser() user: AuthenticatedUser, @Body() dto: SyncDto) {
        return this.syncService.sync(user.id, {
            items: dto.items,
            playlists: dto.playlists,
            since: dto.since ?? 0,
        });
    }
}
