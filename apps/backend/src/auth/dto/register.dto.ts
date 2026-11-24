import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
    @ApiProperty({ example: "user@example.com" })
    @Transform(({ value }: { value: unknown }) =>
        typeof value === "string" ? value.trim().toLowerCase() : value
    )
    @IsEmail({}, { message: "email must be a valid email address" })
    @MaxLength(255)
    email!: string;

    @ApiProperty({
        example: "StrongPass1",
        minLength: 8,
        maxLength: 72,
        description: "8–72 characters, at least one letter and one digit.",
    })
    @IsString()
    @MinLength(8, { message: "password must be at least 8 characters long" })
    @MaxLength(72) // bcrypt silently truncates beyond 72 bytes
    @Matches(/\p{L}/u, { message: "password must contain at least one letter" })
    @Matches(/\d/, { message: "password must contain at least one digit" })
    password!: string;
}
