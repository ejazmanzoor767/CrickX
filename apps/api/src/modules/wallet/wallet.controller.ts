import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WalletService } from './wallet.service';
import { InitiateDepositDto, RequestWithdrawalDto, ConfirmCheckoutDepositDto } from './dto';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  private uid(req: Request) {
    return (req as unknown as { user: { userId: string } }).user.userId;
  }

  @Get()
  get(@Req() req: Request) {
    return this.wallet.getWallet(this.uid(req));
  }

  @Get('transactions')
  transactions(@Req() req: Request, @Query('page') page?: string) {
    return this.wallet.listTransactions(this.uid(req), page ? parseInt(page, 10) : 1);
  }

  @Post('deposits')
  deposit(@Req() req: Request, @Body() dto: InitiateDepositDto) {
    return this.wallet.initiateDeposit(this.uid(req), dto.amount, dto.paymentGateway);
  }

  @Post('deposits/confirm')
  confirmDeposit(@Req() req: Request, @Body() dto: ConfirmCheckoutDepositDto) {
    return this.wallet.confirmDepositFromCheckout(
      this.uid(req), dto.depositId, dto.razorpayPaymentId, dto.razorpayOrderId, dto.razorpaySignature,
    );
  }

  @Post('withdrawals')
  withdraw(@Req() req: Request, @Body() dto: RequestWithdrawalDto) {
    return this.wallet.requestWithdrawal(this.uid(req), dto.amount, dto.bankAccountLast4);
  }
}
