import { describe, test, expect } from 'vitest';

import ProductPagesAPI from '../../src/index';

const INSTANCE =
  process.env.PP_INSTANCE ?? 'https://pp-stage.engineering.redhat.com/api/v7';

const hasKerberosTicket = (() => {
  try {
    require.resolve('kerberos');
    return !!process.env.RUN_KERBEROS_TESTS;
  } catch {
    return false;
  }
})();

describe('ProductPagesAPI.whoami', () => {
  test.skipIf(!hasKerberosTicket)(
    'returns parsed response in strict mode (default)',
    async () => {
      const api = new ProductPagesAPI(INSTANCE, {
        type: 'kerberos',
      });

      const result = await api.whoami();
      expect(result).toHaveProperty('username');
    }
  );
});
