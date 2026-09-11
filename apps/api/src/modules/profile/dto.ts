import { IsOptional, IsString, IsInt } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsInt() favoriteTeamSportmonksId?: number;
}
