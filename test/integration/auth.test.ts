import { describe, test, expect } from 'vitest';

import ProductPagesAPI from '../../src/index';

const INSTANCE =
  process.env.PP_INSTANCE ?? 'https://pp-stage.engineering.redhat.com/api/v7';
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID;
const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET;
const TOKEN_ENDPOINT =
  process.env.TOKEN_ENDPOINT ??
  'https://auth.redhat.com/auth/realms/EmployeeIDP/protocol/openid-connect/token';

describe('OIDC authentication', () => {
  test.skipIf(!OIDC_CLIENT_ID || !OIDC_CLIENT_SECRET)(
    'authenticates with client credentials and calls whoami',
    async () => {
      const api = new ProductPagesAPI(INSTANCE, {
        type: 'oidc',
        tokenEndpoint: TOKEN_ENDPOINT,
        clientId: OIDC_CLIENT_ID!,
        clientSecret: OIDC_CLIENT_SECRET!,
      });

      const result = await api.whoami();
      expect(result).toHaveProperty('username');
      expect(result).toMatchInlineSnapshot();
    }
  );
});

describe('Kerberos authentication', () => {
  const hasKerberosTicket = (() => {
    try {
      require.resolve('kerberos');
      return !!process.env.RUN_KERBEROS_TESTS;
    } catch {
      return false;
    }
  })();

  test.skipIf(!hasKerberosTicket)(
    'authenticates with Kerberos ticket and calls whoami',
    async () => {
      const api = new ProductPagesAPI(INSTANCE, {
        type: 'kerberos',
      });

      const result = await api.whoami();
      expect(result).toHaveProperty('username');
      expect(result).toMatchInlineSnapshot();
    }
  );
});

describe('API key authentication', () => {
  const API_KEY = process.env.PP_API_KEY;

  test.skipIf(!API_KEY)(
    'authenticates with API key and calls whoami',
    async () => {
      const api = new ProductPagesAPI(INSTANCE, API_KEY!);

      const result = await api.whoami();
      expect(result).toHaveProperty('username');
      expect(result).toMatchInlineSnapshot();
    }
  );
});
