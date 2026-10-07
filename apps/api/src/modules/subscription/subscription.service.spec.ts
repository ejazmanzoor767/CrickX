import { SubscriptionService } from './subscription.service';

describe('SubscriptionService payment recovery', () => {
  function buildService(overrides: Record<string, any> = {}) {
    const firestore = {
      subscription: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      },
      subscriptionPayment: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      },
      db: { collection: jest.fn() },
      ...overrides,
    };
    const config = { get: jest.fn().mockReturnValue('false') };
    const oxapay = {
      getPaymentInfo: jest.fn(),
      ...overrides.oxapay,
    };
    const service = new SubscriptionService(firestore as any, config as any, oxapay as any);
    return { service, firestore, oxapay };
  }

  it('activates a pending subscription when OxaPay confirms the exact invoice was paid', async () => {
    const createdAt = new Date(Date.now() - 60_000);
    const subscription = {
      id: 'sub-1',
      userId: 'user-1',
      plan: 'WEEKLY',
      amount: 0.18,
      currency: 'USD',
      status: 'PENDING',
      basketId: 'CRX-SUB-123',
      createdAt,
    };
    const payment = {
      id: 'pay-1',
      userId: 'user-1',
      subscriptionId: 'sub-1',
      basketId: subscription.basketId,
      provider: 'OXAPAY',
      status: 'INITIATED',
      amount: 0.18,
      currency: 'USD',
      gatewayTxnRef: 'track-1',
      createdAt,
    };
    const { service, firestore, oxapay } = buildService();
    firestore.subscription.findMany.mockResolvedValue([subscription]);
    firestore.subscriptionPayment.findFirst.mockResolvedValue(payment);
    oxapay.getPaymentInfo.mockResolvedValue({
      status: 'Paid',
      order_id: subscription.basketId,
      track_id: 'track-1',
      amount: 0.18,
      currency: 'USD',
    });

    const result = await service.status('user-1');

    expect(result.active).toBe(true);
    expect(result.status).toBe('ACTIVE');
    expect(result.basketId).toBe(subscription.basketId);
    expect(firestore.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1' },
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
    expect(firestore.subscriptionPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ status: 'SUCCEEDED', eventId: 'track-1' }),
      }),
    );
  });

  it('activates a monthly pending subscription for 30 days at $0.60', async () => {
    const createdAt = new Date(Date.now() - 60_000);
    const subscription = {
      id: 'sub-monthly',
      userId: 'user-monthly',
      plan: 'MONTHLY',
      amount: 0.60,
      currency: 'USD',
      status: 'PENDING',
      basketId: 'CRX-SUB-MONTHLY',
      createdAt,
    };
    const payment = {
      id: 'pay-monthly',
      userId: 'user-monthly',
      subscriptionId: 'sub-monthly',
      basketId: subscription.basketId,
      provider: 'OXAPAY',
      status: 'INITIATED',
      amount: 0.60,
      currency: 'USD',
      gatewayTxnRef: 'track-monthly',
      createdAt,
    };
    const { service, firestore, oxapay } = buildService();
    firestore.subscription.findMany.mockResolvedValue([subscription]);
    firestore.subscriptionPayment.findFirst.mockResolvedValue(payment);
    oxapay.getPaymentInfo.mockResolvedValue({
      status: 'Paid',
      order_id: subscription.basketId,
      track_id: 'track-monthly',
      amount: 0.60,
      currency: 'USD',
    });

    const before = Date.now();
    const result = await service.status('user-monthly');

    expect(result.active).toBe(true);
    expect(result.plan).toBe('MONTHLY');
    expect(result.amount).toBe(0.6);
    expect(result.durationDays).toBe(30);
    expect(new Date(String(result.expiresAt)).getTime()).toBeGreaterThanOrEqual(
      before + 29 * 24 * 60 * 60 * 1000,
    );
  });

  it('allows a qualified referral code to be used once and rejects a second user', async () => {
    const referralSets: Array<Record<string, any>> = [];
    const referralCodeGet = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ userId: 'referrer-1', code: 'CRXABC12345' }),
    });
    const existingDocs = new Map<string, any>();
    const usageGet = jest
      .fn()
      .mockResolvedValueOnce({ empty: true, docs: [] })
      .mockResolvedValueOnce({
        empty: false,
        docs: [{
          id: 'user-a',
          data: () => ({
            referredUserId: 'user-a',
            status: 'PENDING',
          }),
        }],
      });

    const referralCollection = {
      doc: jest.fn((userId: string) => {
        if (!existingDocs.has(userId)) {
          existingDocs.set(userId, {
            get: jest.fn().mockResolvedValue({ exists: false }),
            set: jest.fn(async (value: any) => {
              referralSets.push(value);
            }),
          });
        }
        return existingDocs.get(userId);
      }),
      where: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: usageGet,
        })),
      })),
    };

    const { service, firestore } = buildService();
    firestore.subscription.findMany.mockImplementation(async ({ where }: any) => {
      if (where.userId === 'referrer-1') {
        return [{ id: 'referrer-sub', userId: 'referrer-1', status: 'EXPIRED', startedAt: new Date(Date.now() - 86_400_000) }];
      }
      return [];
    });
    firestore.db.collection.mockImplementation((name: string) => {
      if (name === 'referralCodes') {
        return { doc: jest.fn(() => ({ get: referralCodeGet })) };
      }
      if (name === 'referrals') {
        return referralCollection;
      }
      throw new Error(`Unexpected collection: ${name}`);
    });

    const first = await service.applyReferral('user-a', 'CRXABC12345', 'a@example.com');
    expect(first).toEqual({ applied: true, status: 'PENDING', referrerId: 'referrer-1' });

    await expect(service.applyReferral('user-b', 'CRXABC12345', 'b@example.com'))
      .rejects
      .toThrow('This code has already been added by another user.');
  });

  it('rejects a referral code until the referrer has completed a subscription', async () => {
    const referralCodeGet = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ userId: 'referrer-new', code: 'CRXNEW12345' }),
    });

    const { service, firestore } = buildService();
    firestore.subscription.findMany.mockResolvedValue([]);
    firestore.db.collection.mockImplementation((name: string) => {
      if (name === 'referralCodes') {
        return { doc: jest.fn(() => ({ get: referralCodeGet })) };
      }
      if (name === 'referrals') {
        return { doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ exists: false }) })) };
      }
      throw new Error(`Unexpected collection: ${name}`);
    });

    await expect(service.applyReferral('user-a', 'CRXNEW12345', 'a@example.com'))
      .rejects
      .toThrow('The referrer must complete a subscription first.');
  });

  it('keeps a referral pending until the referred user subscribes', async () => {
    const referralSet = jest.fn().mockResolvedValue(undefined);
    const referralCodeGet = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ userId: 'referrer-1', code: 'CRXABC12345' }),
    });
    const existingReferralGet = jest.fn().mockResolvedValue({ exists: false });

    const { service, firestore } = buildService();
    firestore.subscription.findMany.mockImplementation(async ({ where }: any) => {
      if (where.userId === 'referrer-1') {
        return [{ id: 'referrer-sub', userId: 'referrer-1', status: 'ACTIVE', startedAt: new Date(Date.now() - 60_000) }];
      }
      if (where.userId === 'referred-1') return [];
      return [];
    });
    firestore.db.collection.mockImplementation((name: string) => {
      if (name === 'referralCodes') {
        return { doc: jest.fn(() => ({ get: referralCodeGet })) };
      }
      if (name === 'referrals') {
        return { doc: jest.fn(() => ({ get: existingReferralGet, set: referralSet })) };
      }
      throw new Error(`Unexpected collection: ${name}`);
    });

    const result = await service.applyReferral('referred-1', 'CRXABC12345', 'referred@example.com');

    expect(result).toEqual({ applied: true, status: 'PENDING', referrerId: 'referrer-1' });
    expect(referralSet).toHaveBeenCalledWith(
      expect.objectContaining({
        referrerId: 'referrer-1',
        referredUserId: 'referred-1',
        referralCode: 'CRXABC12345',
        status: 'PENDING',
        subscriptionId: null,
        qualifiedAt: null,
      }),
      { merge: false },
    );
  });

  it('does not activate a pending subscription when the gateway order does not match', async () => {
    const createdAt = new Date(Date.now() - 60_000);
    const subscription = {
      id: 'sub-2',
      userId: 'user-2',
      plan: 'WEEKLY',
      amount: 0.18,
      currency: 'USD',
      status: 'PENDING',
      basketId: 'CRX-SUB-456',
      createdAt,
    };
    const payment = {
      id: 'pay-2',
      userId: 'user-2',
      subscriptionId: 'sub-2',
      basketId: subscription.basketId,
      provider: 'OXAPAY',
      status: 'INITIATED',
      amount: 0.18,
      currency: 'USD',
      gatewayTxnRef: 'track-2',
      createdAt,
    };
    const { service, firestore, oxapay } = buildService();
    firestore.subscription.findMany.mockResolvedValue([subscription]);
    firestore.subscriptionPayment.findFirst.mockResolvedValue(payment);
    oxapay.getPaymentInfo.mockResolvedValue({
      status: 'Paid',
      order_id: 'CRX-SUB-WRONG',
      track_id: 'track-2',
      amount: 0.18,
      currency: 'USD',
    });

    const result = await service.status('user-2');

    expect(result.active).toBe(false);
    expect(result.status).toBe('PENDING');
    expect(firestore.subscription.update).not.toHaveBeenCalled();
    expect(firestore.subscriptionPayment.update).not.toHaveBeenCalled();
  });
});
