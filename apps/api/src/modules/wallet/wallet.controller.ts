import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WalletService } from './wallet.service';
import { EarlyBuyCheckoutDto } from './dto';

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
    const raw = page ? Number.parseInt(page, 10) : 1;
    const value = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 100) : 1;
    return this.wallet.listTransactions(this.uid(req), value);
  }

  @Post('early-buy/checkout')
  earlyBuyCheckout(@Req() req: Request, @Body() dto: EarlyBuyCheckoutDto) {
    return this.wallet.earlyBuyCheckout(this.uid(req), dto.amountUsd, dto.walletAddress);
  }

  @Get('early-buy/status')
  earlyBuyStatus(@Req() req: Request, @Query('order') order?: string) {
    if (!order) throw new BadRequestException('order query parameter is required.');
    return this.wallet.earlyBuyPaymentStatus(this.uid(req), order);
  }
}
