import { ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export const FREE_CONTEST_ENTRY_FEE = 0;
export const CRX_PRIZE_PER_PARTICIPANT = 10;

export class CreateFantasyTeamDto {
  @IsInt() sportmonksFixtureId!: number;
  @IsString() name!: string;
  @IsArray() @ArrayMinSize(11) @ArrayMaxSize(11) @IsInt({ each: true })
  sportmonksPlayerIds!: number[];
  @IsInt() captainSportmonksPlayerId!: number;
  @IsInt() viceCaptainSportmonksPlayerId!: number;
}

export class CreateContestDto {
  @IsInt() sportmonksFixtureId!: number;
  @IsString() name!: string;
  @IsOptional() @Equals(FREE_CONTEST_ENTRY_FEE, { message: 'CrickX contest entry is free.' }) entryFee?: number;
  @Min(0) totalSpots!: number;
  @IsString() scoringRuleSetId!: string;
  prizeDistribution!: { rankFrom: number; rankTo: number; amount: number }[];
}

export class PrepareJoinContestDto {
  @IsString() contestId!: string;
  @IsString() fantasyTeamId!: string;
}

export class JoinContestDto extends PrepareJoinContestDto {
  @IsString() walletAddress!: string;
  @IsString() walletSignature!: string;
  @IsInt() walletMessageTimestamp!: number;
}
