import { IsArray, IsInt, IsNumber, IsString, ValidateNested, Min } from 'class-validator';
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
  @IsString() name!: string;
  @IsString() matchType!: string;
  rules!: Record<string, number>;
}

export class ReviewKycDto {
  @IsString() status!: 'APPROVED' | 'REJECTED';
  @IsString() note?: string;
}

export class ReviewWithdrawalDto {
  @IsString() status!: 'APPROVED' | 'REJECTED' | 'PAID';
  @IsString() note?: string;
  @IsString() payoutReference?: string;
}
