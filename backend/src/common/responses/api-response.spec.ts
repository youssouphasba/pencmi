import { apiSuccess } from './api-response';

describe('apiSuccess', () => {
  it('wraps data in the standard API response', () => {
    expect(apiSuccess({ ok: true })).toEqual({
      success: true,
      data: { ok: true },
    });
  });

  it('includes metadata when provided', () => {
    expect(apiSuccess([], { page: 1, total: 0 })).toEqual({
      success: true,
      data: [],
      meta: { page: 1, total: 0 },
    });
  });
});
