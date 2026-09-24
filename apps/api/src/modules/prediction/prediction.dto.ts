import { IsArray, ArrayMaxSize, ArrayMinSize, IsInt, IsString, MaxLength } from 'class-validator';

export class PredictionAnswerDto {
  @IsString() @MaxLength(80) questionId!: string;
  @IsString() @MaxLength(80) answer!: string;
}

export class SubmitPredictionDto {
  @IsArray() @ArrayMinSize(5) @ArrayMaxSize(5) answers!: PredictionAnswerDto[];
  @IsString() @MaxLength(42) walletAddress!: string;
  @IsString() @MaxLength(300) walletSignature!: string;
  @IsInt() walletMessageTimestamp!: number;
}
