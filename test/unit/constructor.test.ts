import { describe, test, expect } from 'vitest';

import ProductPagesAPI from '../../src/index';

describe('ProductPagesAPI constructor', () => {
  test('creates instance without auth (public)', () => {
    const api = new ProductPagesAPI('https://productpages.redhat.com/api/v7');
    expect(api).toBeInstanceOf(ProductPagesAPI);
  });

  test('creates instance with string API key (backward compat)', () => {
    const api = new ProductPagesAPI(
      'https://productpages.redhat.com/api/v7',
      'my-api-key'
    );
    expect(api).toBeInstanceOf(ProductPagesAPI);
  });

  test('creates instance with apiKey auth options', () => {
    const api = new ProductPagesAPI('https://productpages.redhat.com/api/v7', {
      type: 'apiKey',
      apiKey: 'my-api-key',
    });
    expect(api).toBeInstanceOf(ProductPagesAPI);
  });

  test('creates instance with OIDC auth options', () => {
    const api = new ProductPagesAPI('https://productpages.redhat.com/api/v7', {
      type: 'oidc',
      tokenEndpoint: 'https://auth.example.com/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });
    expect(api).toBeInstanceOf(ProductPagesAPI);
  });

  test('creates instance with Kerberos auth options', () => {
    const api = new ProductPagesAPI('https://productpages.redhat.com/api/v7', {
      type: 'kerberos',
    });
    expect(api).toBeInstanceOf(ProductPagesAPI);
  });

  test('creates instance with custom instance URL', () => {
    const api = new ProductPagesAPI('https://custom.example.com/api/v7');
    expect(api).toBeInstanceOf(ProductPagesAPI);
  });

  test('creates instance with custom instance and OIDC auth', () => {
    const api = new ProductPagesAPI(
      'https://pp.engineering.redhat.com/api/v7',
      {
        type: 'oidc',
        tokenEndpoint:
          'https://auth.redhat.com/auth/realms/EmployeeIDP/protocol/openid-connect/token',
        clientId: 'my-client',
        clientSecret: 'my-secret',
      }
    );
    expect(api).toBeInstanceOf(ProductPagesAPI);
  });
});
