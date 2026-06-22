import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
    @ApiProperty({ example: "user@example.com" })
    @IsEmail({}, { message: "email must be a valid email address" })
    email!: string;

    @ApiProperty({
        example: "StrongP@ss1",
        minLength: 8,
        maxLength: 72,
        description: "Min 8 chars. Max 72 chars (bcrypt limit).",
    })
    @IsString()
    @MinLength(8)
    @MaxLength(72) // bcrypt silently truncates beyond 72 bytes
    password!: string;
}
