import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { UsersService } from "./users.service";

class PushTokenDto {
    @ApiProperty({ example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    token!: string | null;
}

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get("me")
    @ApiOperation({ summary: "Current user's profile" })
    async me(@CurrentUser() current: AuthenticatedUser) {
        const user = await this.usersService.findById(current.id);
        if (!user) throw new NotFoundException();
        return {
            id: user.id,
            email: user.email,
            role: user.role,
            monthlyAnalysisLimit: user.monthlyAnalysisLimit,
            createdAt: user.createdAt,
        };
    }

    @Put("me/push-token")
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: "Register (or clear) the device's Expo push token" })
    async setPushToken(@CurrentUser() current: AuthenticatedUser, @Body() dto: PushTokenDto) {
        await this.usersService.setPushToken(current.id, dto.token || null);
    }
}
