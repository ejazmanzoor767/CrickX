import { IsNumber, Min, Max, Matches } from 'class-validator';

export class EarlyBuyCheckoutDto {
  @IsNumber() @Min(1) @Max(100_000) amountUsd!: number;
  @Matches(/^0x[0-9a-fA-F]{40}$/) walletAddress!: string;
}
