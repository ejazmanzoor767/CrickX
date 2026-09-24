import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, randomBytes } from 'crypto';
import { FirestoreService } from '../../common/firestore.service';
import { UpdateProfileDto } from './dto';

const MAX_AVATAR_DATA_URL_LENGTH = 850_000;
const ALLOWED_AVATAR_DATA_URL = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\s]+$/i;

function kycEncryptionKey() {
  const raw = String(process.env.KYC_ENCRYPTION_KEY || '').trim();
  let key: Buffer | null = null;

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else {
    try {
      const decoded = Buffer.from(raw, 'base64');
      if (decoded.length === 32) key = decoded;
    } catch {
      key = null;
    }
  }

  if (!key || key.length !== 32) {
    throw new ServiceUnavailableException(
      'KYC encryption is not configured. Set a unique 32-byte KYC_ENCRYPTION_KEY before submitting documents.',
    );
  }
  return key;
}

function encryptKycValue(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', kycEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

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

  async submitKyc(userId: string, documentType: string, documentNumber: string) {
    const encrypted = encryptKycValue(documentNumber.trim());
    const record = await this.prisma.kycRecord.create({
      data: {
        userId,
        documentType: documentType.trim().toUpperCase(),
        documentNumberEncrypted: encrypted,
      },
    });
    return {
      id: record.id,
      status: record.status,
      submittedAt: record.submittedAt,
    };
  }

  async kycStatus(userId: string) {
    const record = await this.prisma.kycRecord.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
    });
    if (!record) return null;
    return {
      id: record.id,
      status: record.status,
      documentType: record.documentType,
      rejectionReason: record.rejectionReason ?? null,
      submittedAt: record.submittedAt,
      reviewedAt: record.reviewedAt ?? null,
    };
  }
}
