import { Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../../common/firestore.service';
import { UpdateProfileDto } from './dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: FirestoreService) {}

  async get(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found.');
    return profile;
  }

  async update(userId: string, dto: UpdateProfileDto) {
    return this.prisma.profile.update({ where: { userId }, data: dto });
  }

  async submitKyc(userId: string, documentType: string, documentNumberEncrypted: string) {
    return this.prisma.kycRecord.create({ data: { userId, documentType, documentNumberEncrypted } });
  }

  async kycStatus(userId: string) {
    return this.prisma.kycRecord.findFirst({ where: { userId }, orderBy: { submittedAt: 'desc' } });
  }
}
