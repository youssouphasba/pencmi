import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { randomUUID } from 'crypto';
import { UpdateUserProfileDto } from './users.dto';
import { ChangePasswordDto } from '../../auth/dto/account-security.dto';

describe('Account profile and credential validation', () => {
  it('normalizes spaces and Unicode without inventing omitted values', async () => {
    const dto = plainToInstance(UpdateUserProfileDto, {
      firstName: '  Ame\u0301lie \t Diop ',
      city: '',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({ firstName: 'Amélie Diop', city: null });
    expect(dto.lastName).toBeUndefined();
  });
  it.each([
    { firstName: 12 },
    { city: '\u0000' },
    { lastName: 'a'.repeat(101) },
  ])('rejects invalid profile values', async (body) => {
    expect(
      (await validate(plainToInstance(UpdateUserProfileDto, body))).length,
    ).toBeGreaterThan(0);
  });
  it.each(['email', 'phone', 'avatarUrl', 'role', 'userId'])(
    'rejects forbidden field %s under the production whitelist',
    async (key) => {
      const errors = await validate(
        plainToInstance(UpdateUserProfileDto, { [key]: 'injected' }),
        { whitelist: true, forbidNonWhitelisted: true },
      );
      expect(errors.some((error) => error.property === key)).toBe(true);
    },
  );
  it('enforces the new-password policy without trimming password characters', async () => {
    const currentPassword = 'Az9!' + randomUUID();
    const valid = plainToInstance(ChangePasswordDto, {
      currentPassword,
      newPassword: 'Az9!' + randomUUID(),
    });
    expect(await validate(valid)).toEqual([]);
    expect(valid.currentPassword).toBe(currentPassword);
    expect(
      (
        await validate(
          plainToInstance(ChangePasswordDto, {
            currentPassword,
            newPassword: 'short',
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
