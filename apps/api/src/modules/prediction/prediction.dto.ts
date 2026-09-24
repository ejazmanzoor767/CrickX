import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsString } from 'class-validator';

export class SubmitPredictionDto {
  @IsArray() @ArrayMinSize(5) @ArrayMaxSize(5)
  answers!: Array<{ questionId: string; answer: string }>;
  @IsString() walletAddress!: string;
  @IsString() walletSignature!: string;
  @IsInt() walletMessageTimestamp!: number;
}