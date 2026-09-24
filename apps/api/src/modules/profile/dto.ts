import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) displayName?: string;
  @IsOptional() @IsString() @MaxLength(120) avatarUrl?: string;
  @IsOptional() @IsString() @MaxLength(120) state?: string;
  @IsOptional() @IsString() @MaxLength(2) country?: string;
  @IsOptional() favoriteTeamSportmonksId?: number;
}
