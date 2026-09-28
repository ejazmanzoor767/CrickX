import { IsArray, IsInt, IsNumber, IsString, ValidateNested, Min, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class SetPlayerCreditDto {
  @IsInt() sportmonksFixtureId!: number;
  @IsInt() sportmonksPlayerId!: number;
  @IsInt() sportmonksTeamId!: number;
  @IsNumber() @Min(0) credits!: number;
}

export class BulkSetCreditsDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => SetPlayerCreditDto)
  credits!: SetPlayerCreditDto[];
}

export class CreateScoringRuleSetDto {
  @IsString() @MaxLength(80) name!: string;
  @IsString() @MaxLength(20) matchType!: string;
  rules!: Record<string, number>;
}

export class ReviewKycDto {
  @IsIn(['APPROVED', 'REJECTED']) status!: 'APPROVED' | 'REJECTED';
  @IsString() @MaxLength(500) note?: string;
}

export class ReviewWithdrawalDto {
  @IsIn(['APPROVED', 'REJECTED', 'PAID']) status!: 'APPROVED' | 'REJECTED' | 'PAID';
  @IsString() @MaxLength(500) note?: string;
  @IsString() @MaxLength(120) payoutReference?: string;
}
