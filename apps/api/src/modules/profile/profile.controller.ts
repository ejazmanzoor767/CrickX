import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  private uid(req: Request) {
    return (req as unknown as { user: { userId: string } }).user.userId;
  }

  @Get()
  get(@Req() req: Request) {
    return this.profile.get(this.uid(req));
  }

  @Put()
  update(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    return this.profile.update(this.uid(req), dto);
  }

  @Post('kyc')
  submitKyc(@Req() req: Request, @Body() body: { documentType: string; documentNumber: string }) {
    return this.profile.submitKyc(this.uid(req), body.documentType, body.documentNumber);
  }

  @Get('kyc')
  kycStatus(@Req() req: Request) {
    return this.profile.kycStatus(this.uid(req));
  }
}
