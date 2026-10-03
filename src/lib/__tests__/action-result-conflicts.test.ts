import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  unstable_rethrow: (error: unknown) => {
    if ((error as { digest?: string } | null)?.digest) throw error;
  },
}));

import { toActionError } from '../action-result';

const prismaError = (code: string, target?: unknown) =>
  Object.assign(new Error('constraint'), {
    name: 'PrismaClientKnownRequestError',
    code,
    meta: target === undefined ? undefined : { target },
  });

describe('database constraint violations become conflicts a person can fix', () => {
  it('maps a unique slug violation to a CONFLICT on the slug field', () => {
    const result = toActionError(prismaError('P2002', ['slug']));
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'CONFLICT', fieldErrors: { slug: [expect.stringMatching(/already in use/)] } },
    });
  });

  it('reads the field from a constraint name too', () => {
    expect(toActionError(prismaError('P2002', 'product_variants_sku_key'))).toMatchObject({
      error: { code: 'CONFLICT', fieldErrors: { sku: expect.any(Array) } },
    });
    expect(toActionError(prismaError('P2002', 'categories_path_key'))).toMatchObject({
      error: { fieldErrors: { slug: expect.any(Array) } },
    });
  });

  it('still reports a conflict when the field is unknown, and for dependent rows', () => {
    const unknown = toActionError(prismaError('P2002', ['something_else']));
    expect(unknown).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    expect(toActionError(prismaError('P2003'))).toMatchObject({ error: { code: 'CONFLICT' } });
  });

  it('leaves other database errors as internal failures', () => {
    expect(toActionError(prismaError('P2025'))).toMatchObject({ error: { code: 'INTERNAL' } });
  });
});
