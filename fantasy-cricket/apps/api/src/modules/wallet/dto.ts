import { IsNumber, IsString, Min } from 'class-validator';

export class InitiateDepositDto {
  @IsNumber() @Min(1) amount!: number;
  @IsString() paymentGateway!: string;
}

export class ConfirmCheckoutDepositDto {
  @IsString() depositId!: string;
  @IsString() razorpayPaymentId!: string;
  @IsString() razorpayOrderId!: string;
  @IsString() razorpaySignature!: string;
}

export class RequestWithdrawalDto {
  @IsNumber() @Min(1) amount!: number;
  @IsString() bankAccountLast4!: string;
}
