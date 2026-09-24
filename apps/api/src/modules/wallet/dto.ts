import { IsNumber, IsString, Min, Max, MaxLength, Matches } from 'class-validator';

export class InitiateDepositDto {
  @IsNumber() @Min(1) @Max(1_000_000) amount!: number;
  @IsString() @MaxLength(32) paymentGateway!: string;
}

export class ConfirmCheckoutDepositDto {
  @IsString() @MinLength(1) @MaxLength(120) depositId!: string;
  @IsString() @MinLength(1) @MaxLength(200) razorpayPaymentId!: string;
  @IsString() @MinLength(1) @MaxLength(120) razorpayOrderId!: string;
  @IsString() @MinLength(32) @MaxLength(128) razorpaySignature!: string;
}

export class RequestWithdrawalDto {
  @IsNumber() @Min(1) @Max(1_000_000) amount!: number;
  @Matches(/^\d{4}$/) bankAccountLast4!: string;
}

export class EarlyBuyCheckoutDto {
  @IsNumber() @Min(1) @Max(100_000) amountUsd!: number;
  @Matches(/^0x[0-9a-fA-F]{40}$/) walletAddress!: string;
}
