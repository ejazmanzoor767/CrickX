import { BadRequestException, Body, Controller, Get, Headers, Header, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateSubscriptionCheckoutDto } from './dto';
import { SubscriptionService } from './subscription.service';
import { OxaPayService } from './oxapay.service';

function uid(req: Request) {
  return (req as unknown as { user: { userId: string } }).user.userId;
}

@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly oxapay: OxaPayService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  status(@Req() req: Request) {
    return this.subscriptions.status(uid(req));
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  checkout(@Req() req: Request, @Body() _dto: CreateSubscriptionCheckoutDto) {
    return this.subscriptions.checkout(uid(req));
  }

  @Get('status')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(JwtAuthGuard)
  paymentStatus(@Req() req: Request, @Query('basket') basket?: string) {
    if (!basket) throw new BadRequestException('basket query parameter is required.');
    return this.subscriptions.paymentStatus(uid(req), basket);
  }

  @Post('webhook')
  async webhook(@Req() req: Request, @Headers('hmac') signature: string) {
    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
    if (!rawBody) throw new BadRequestException('Raw webhook body is unavailable.');
    if (!this.oxapay.verifyWebhook(rawBody, signature)) {
      throw new BadRequestException('Invalid OxaPay webhook signature.');
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid webhook JSON.');
    }

    await this.subscriptions.handleWebhook(payload);
    return 'ok';
  }
}
