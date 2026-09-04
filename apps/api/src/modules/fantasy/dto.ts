import { ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsInt, IsString, Min } from 'class-validator';

export const DEMO_ENTRY_FEE_GEMS = 4;

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
  @Equals(DEMO_ENTRY_FEE_GEMS, { message: 'CrickX demo contest entry fee must be exactly 4 Gems.' }) entryFee!: number;
  @Min(2) totalSpots!: number;
  @IsString() scoringRuleSetId!: string;
  prizeDistribution!: { rankFrom: number; rankTo: number; amount: number }[];
}

export class JoinContestDto {
  @IsString() contestId!: string;
  @IsString() fantasyTeamId!: string;
}
