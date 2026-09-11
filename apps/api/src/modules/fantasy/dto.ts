import { ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsInt, IsString, Min, Matches } from 'class-validator';

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
  @Equals(DEMO_ENTRY_FEE_GEMS, { message: 'CrickX contest entry fee is fixed at 4 CRX.' }) entryFee!: number;
  @Min(0) totalSpots!: number; // ignored; contest is unlimited.
  @IsString() scoringRuleSetId!: string;
  prizeDistribution!: { rankFrom: number; rankTo: number; amount: number }[];
}

export class PrepareJoinContestDto {
  @IsString() contestId!: string;
  @IsString() fantasyTeamId!: string;
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'walletAddress must be a valid EVM address.' }) walletAddress!: string;
}

export class JoinContestDto extends PrepareJoinContestDto {
  @Matches(/^0x[a-fA-F0-9]{64}$/, { message: 'transactionHash must be a valid EVM transaction hash.' }) transactionHash!: string;
}
