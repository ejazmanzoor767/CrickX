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
