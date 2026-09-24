import {
  ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsInt, IsOptional,
  IsString, Max, MaxLength, Min, MinLength, ValidateNested, IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export const FREE_CONTEST_ENTRY_FEE = 0;
export const CRX_PRIZE_PER_PARTICIPANT = 10;

export class CreateFantasyTeamDto {
  @IsInt() @Min(1) sportmonksFixtureId!: number;
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsArray() @ArrayMinSize(11) @ArrayMaxSize(11) @IsInt({ each: true }) @Min(1, { each: true })
  sportmonksPlayerIds!: number[];
  @IsInt() @Min(1) captainSportmonksPlayerId!: number;
  @IsInt() @Min(1) viceCaptainSportmonksPlayerId!: number;
}

export class PrizeDistributionRowDto {
  @IsInt() @Min(1) rankFrom!: number;
  @IsInt() @Min(1) rankTo!: number;
  @IsNumber() @Min(0) @Max(1_000_000_000) amount!: number;
}

export class CreateContestDto {
  @IsInt() @Min(1) sportmonksFixtureId!: number;
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @Equals(FREE_CONTEST_ENTRY_FEE, { message: 'CrickX contest entry is free.' }) entryFee?: number;
  @IsOptional() @Min(0) @Max(1_000_000) totalSpots?: number;
  @IsString() @MaxLength(100) scoringRuleSetId!: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PrizeDistributionRowDto)
  prizeDistribution!: PrizeDistributionRowDto[];
}

export class PrepareJoinContestDto {
  @IsString() @Min(1) @MaxLength(120) contestId!: string;
  @IsString() @Min(1) @MaxLength(160) fantasyTeamId!: string;
}

export class JoinContestDto extends PrepareJoinContestDto {
  @IsString() @MinLength(42) @MaxLength(42) walletAddress!: string;
  @IsString() @MinLength(64) @MaxLength(300) walletSignature!: string;
  @IsInt() walletMessageTimestamp!: number;
}

export class SaveFantasyDraftDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(11) @IsInt({ each: true }) @Min(1, { each: true }) sportmonksPlayerIds?: number[];
  @IsOptional() @IsInt() @Min(1) captainSportmonksPlayerId?: number | null;
  @IsOptional() @IsInt() @Min(1) viceCaptainSportmonksPlayerId?: number | null;
}
