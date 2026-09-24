import { IsArray, ArrayMaxSize, ArrayMinSize, IsInt, IsString, MaxLength, Matches } from 'class-validator';

export class PredictionAnswerDto {
  @IsString() @MaxLength(80) questionId!: string;
  @IsString() @MaxLength(80) answer!: string;
}

export class SubmitPredictionDto {
  @IsArray() @ArrayMinSize(5) @ArrayMaxSize(5) answers!: PredictionAnswerDto[];
  @IsString() @Matches(/^0x[0-9a-fA-F]{40}$/) walletAddress!: string;
  @IsString() @MaxLength(300) walletSignature!: string;
  @IsInt() walletMessageTimestamp!: number;
}
