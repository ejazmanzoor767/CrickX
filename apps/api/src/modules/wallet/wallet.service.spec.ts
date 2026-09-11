import { BadRequestException } from '@nestjs/common';
import { WalletService } from './wallet.service';

/**
 * Unit tests around WalletService.mutateBalance — the single most
 * safety-critical piece of logic in the app (real money). We mock Prisma
 * directly rather than hitting a DB, focused on: idempotency, insufficient
 * balance rejection, and optimistic-lock conflict handling.
 */
describe('WalletService.mutateBalance', () => {
  function buildPrismaMock(initialWallet: { depositBalance: number; version: number }) {
    const wallet = { userId: 'u1', ...initialWallet };
    const transactions = new Map<string, any>();

    const prisma = {
      transaction: {
        findUnique: jest.fn(({ where: { idempotencyKey } }: any) => Promise.resolve(transactions.get(idempotencyKey) ?? null)),
        create: jest.fn(({ data }: any) => {
          transactions.set(data.idempotencyKey, data);
          return Promise.resolve(data);
        }),
      },
      wallet: {
        findUnique: jest.fn(() => Promise.resolve({ ...wallet })),
        updateMany: jest.fn(({ where, data }: any) => {
          if (where.version !== wallet.version) return Promise.resolve({ count: 0 });
          wallet.depositBalance = data.depositBalance;
          wallet.version += 1;
          return Promise.resolve({ count: 1 });
        }),
      },
      $transaction: jest.fn((cb: any) => cb(prisma)),
    };
    return { prisma, wallet };
  }

  it('is idempotent — replaying the same idempotencyKey does not double-apply', async () => {
    const { prisma } = buildPrismaMock({ depositBalance: 100, version: 0 });
    const service = new WalletService(prisma as any, {} as any);

    const first = await service.mutateBalance({
      userId: 'u1', bucket: 'DEPOSIT', delta: 50, type: 'DEPOSIT', idempotencyKey: 'dep-1',
    });
    const second = await service.mutateBalance({
      userId: 'u1', bucket: 'DEPOSIT', delta: 50, type: 'DEPOSIT', idempotencyKey: 'dep-1',
    });

    expect(prisma.wallet.updateMany).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('rejects a debit that would take a balance negative', async () => {
    const { prisma } = buildPrismaMock({ depositBalance: 10, version: 0 });
    const service = new WalletService(prisma as any, {} as any);

    await expect(
      service.mutateBalance({ userId: 'u1', bucket: 'DEPOSIT', delta: -20, type: 'CONTEST_ENTRY_DEBIT', idempotencyKey: 'debit-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects on optimistic-lock version mismatch (concurrent update)', async () => {
    const { prisma, wallet } = buildPrismaMock({ depositBalance: 100, version: 0 });
    const service = new WalletService(prisma as any, {} as any);

    // Simulate a concurrent writer bumping the version between read and write.
    prisma.wallet.findUnique.mockResolvedValueOnce({ ...wallet, version: 0 });
    prisma.wallet.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.mutateBalance({ userId: 'u1', bucket: 'DEPOSIT', delta: 10, type: 'DEPOSIT', idempotencyKey: 'dep-2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('correctly applies a credit and returns the resulting transaction record', async () => {
    const { prisma, wallet } = buildPrismaMock({ depositBalance: 0, version: 0 });
    const service = new WalletService(prisma as any, {} as any);

    const tx = await service.mutateBalance({
      userId: 'u1', bucket: 'DEPOSIT', delta: 250, type: 'DEPOSIT', idempotencyKey: 'dep-3',
    });

    expect(Number(tx.amount)).toEqual(250);
    expect(Number(tx.balanceAfter)).toEqual(250);
    expect(wallet.depositBalance).toBe(250);
  });
});
