import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../../common/firestore.service';
import { UpdateProfileDto } from './dto';

const MAX_AVATAR_DATA_URL_LENGTH = 850_000;
const ALLOWED_AVATAR_DATA_URL = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\s]+$/i;

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: FirestoreService) {}

  async get(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found.');
    return profile;
  }

  async update(userId: string, dto: UpdateProfileDto) {
    if (dto.avatarUrl) {
      if (dto.avatarUrl.length > MAX_AVATAR_DATA_URL_LENGTH) {
        throw new BadRequestException('Profile photo is too large. Please choose a smaller image.');
      }
      if (dto.avatarUrl.startsWith('data:image/') && !ALLOWED_AVATAR_DATA_URL.test(dto.avatarUrl)) {
        throw new BadRequestException('Unsupported profile photo format. Use JPG, PNG or WEBP.');
      }
    }

    return this.prisma.profile.update({ where: { userId }, data: dto });
  }

  async submitKyc(userId: string, documentType: string, documentNumberEncrypted: string) {
    return this.prisma.kycRecord.create({ data: { userId, documentType, documentNumberEncrypted } });
  }

  async kycStatus(userId: string) {
    return this.prisma.kycRecord.findFirst({ where: { userId }, orderBy: { submittedAt: 'desc' } });
  }
}
