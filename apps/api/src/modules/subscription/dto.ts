import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSubscriptionCheckoutDto {
  // Checkout currently needs no required fields, but the DTO must contain
  // validation metadata because the global ValidationPipe rejects completely
  // undecorated/unknown DTO values.
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  customerMobile?: string;
}

export class ApplyReferralDto {
  @IsString() @MinLength(4) @MaxLength(32) code!: string;
}
