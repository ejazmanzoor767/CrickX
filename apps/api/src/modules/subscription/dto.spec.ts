import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSubscriptionCheckoutDto } from './dto';

describe('CreateSubscriptionCheckoutDto', () => {
  it('accepts the normal empty checkout body', async () => {
    const dto = plainToInstance(CreateSubscriptionCheckoutDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts an optional customer mobile value', async () => {
    const dto = plainToInstance(CreateSubscriptionCheckoutDto, { customerMobile: '03197789243' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects unexpected checkout fields', async () => {
    const dto = plainToInstance(CreateSubscriptionCheckoutDto, { unknownField: 'x' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'unknownField')).toBe(false);
  });
});
