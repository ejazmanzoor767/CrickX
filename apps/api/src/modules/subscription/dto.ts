import { IsOptional, IsString, Matches } from 'class-validator';

export class CreateSubscriptionCheckoutDto {
  @IsOptional()
  @IsString()
  @Matches(/^03\d{9}$/, { message: 'customerMobile must be a valid Pakistani mobile number (03XXXXXXXXX).' })
  customerMobile?: string;
}
