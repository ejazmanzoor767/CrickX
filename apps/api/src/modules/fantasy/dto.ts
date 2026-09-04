import { IsArray, IsInt, IsString, ArrayMinSize, ArrayMaxSize, Min } from 'class-validator';

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
  @Min(0) entryFee!: number;
  @Min(2) totalSpots!: number;
  @IsString() scoringRuleSetId!: string;
  prizeDistribution!: { rankFrom: number; rankTo: number; amount: number }[];
}

export class JoinContestDto {
  @IsString() contestId!: string;
  @IsString() fantasyTeamId!: string;
}
