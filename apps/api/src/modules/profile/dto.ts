import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) displayName?: string;
  @IsOptional() @IsString() @MaxLength(120) avatarUrl?: string;
  @IsOptional() @IsString() @MaxLength(120) state?: string;
  @IsOptional() @IsString() @MaxLength(2) country?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000_000) favoriteTeamSportmonksId?: number;
}

export class SubmitKycDto {
  @IsString() @MinLength(2) @MaxLength(32) documentType!: string;
  @IsString() @MinLength(4) @MaxLength(64) @Matches(/^[A-Za-z0-9][A-Za-z0-9 .-]*$/) documentNumber!: string;
}
