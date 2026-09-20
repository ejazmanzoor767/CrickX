import { BadRequestException, Body, Controller, Get, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateSubscriptionCheckoutDto } from './dto';
import { SubscriptionService } from './subscription.service';
import { RapidGatewayService } from './rapidgateway.service';

function uid(req: Request) {
  return (req as unknown as { user: { userId: string } }).user.userId;
}

@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly rapid: RapidGatewayService,
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
  @UseGuards(JwtAuthGuard)
  paymentStatus(@Req() req: Request, @Query('basket') basket?: string) {
    if (!basket) throw new BadRequestException('basket query parameter is required.');
    return this.subscriptions.paymentStatus(uid(req), basket);
  }

  @Post('webhook')
  async webhook(
    @Req() req: Request,
    @Headers('x-rapidgateway-signature') signature: string,
    @Headers('x-rg-signature') legacySignature: string,
    @Headers('x-rapidgateway-timestamp') timestamp: string,
    @Headers('x-rg-timestamp') legacyTimestamp: string,
  ) {
    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody ?? (req.body as Buffer);
    const rawBodyString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : JSON.stringify(rawBody);
    const finalSignature = signature || legacySignature;
    const finalTimestamp = timestamp || legacyTimestamp;
    if (!this.rapid.verifyWebhook(rawBodyString, finalSignature, finalTimestamp)) throw new BadRequestException('Invalid RapidGateway webhook signature.');

    let payload: any;
    try {
      payload = JSON.parse(rawBodyString);
    } catch {
      throw new BadRequestException('Invalid webhook JSON.');
    }
    return this.subscriptions.handleWebhook(payload);
  }
}
