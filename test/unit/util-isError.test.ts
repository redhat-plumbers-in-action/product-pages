import { expect, test, describe } from 'vitest';

import { isError } from '../../src/util';

describe('Test isError()', () => {
  test('error response', () => {
    const result = isError({
      code: 0,
      message: 'string',
    });

    expect(result).toBeDefined();
    expect(result).toBe(true);
  });

  test('non-error response', () => {
    const result = isError({
      foo: 'bar',
    });

    expect(result).toBeDefined();
    expect(result).toBe(false);
  });
});
