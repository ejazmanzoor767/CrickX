import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, req.ip, req.headers['user-agent']);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, req.ip, req.headers['user-agent']);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, req.ip, req.headers['user-agent']);
  }

  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }
}
