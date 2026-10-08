import { IsEmail, IsString, MinLength, IsOptional, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @IsString() @MinLength(1) @MaxLength(80) displayName!: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
}

export class LoginDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MaxLength(128) password!: string;
}

export class RefreshDto {
  @IsString() @MinLength(32) @MaxLength(256) refreshToken!: string;
}
