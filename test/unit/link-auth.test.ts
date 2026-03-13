import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

import { PublicLink, ApiKeyLink, OIDCLink, KerberosLink } from '../../src/link';

vi.mock('axios', async importOriginal => {
  const actual = (await importOriginal()) as typeof axios;

  return {
    ...actual,
    default: {
      ...actual,
      request: vi.fn(),
      post: vi.fn(),
      isAxiosError: actual.isAxiosError,
    },
  };
});

vi.mock('kerberos', () => ({
  initializeClient: vi.fn(),
}));

const mockedAxiosRequest = vi.mocked(axios.request);
const mockedAxiosPost = vi.mocked(axios.post);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PublicLink', () => {
  test('sends GET request without auth headers', async () => {
    mockedAxiosRequest.mockResolvedValue({
      data: { result: 'ok' },
    });

    const link = new PublicLink(
      new URL('https://pp-stage.engineering.redhat.com/api/v7')
    );
    const result = await link.get('whoami');

    expect(mockedAxiosRequest).toHaveBeenCalledOnce();
    const config = mockedAxiosRequest.mock.calls[0][0];
    expect(config.url).toBe(
      'https://pp-stage.engineering.redhat.com/api/v7/whoami'
    );
    expect(config.method).toBe('GET');
    expect(config.headers).not.toHaveProperty('Authorization');
    expect(result).toEqual({ result: 'ok' });
  });
});

describe('ApiKeyLink', () => {
  test('sends Bearer token in Authorization header', async () => {
    mockedAxiosRequest.mockResolvedValue({
      data: { user: 'test' },
    });

    const link = new ApiKeyLink(
      new URL('https://pp-stage.engineering.redhat.com/api/v7'),
      'my-api-key'
    );
    const result = await link.get('whoami');

    expect(mockedAxiosRequest).toHaveBeenCalledOnce();
    const config = mockedAxiosRequest.mock.calls[0][0];
    expect(config.headers).toHaveProperty('Authorization', 'Bearer my-api-key');
    expect(result).toEqual({ user: 'test' });
  });
});

describe('OIDCLink', () => {
  const oidcOptions = {
    type: 'oidc' as const,
    tokenEndpoint: 'https://auth.example.com/token',
    clientId: 'test-client',
    clientSecret: 'test-secret',
  };

  test('fetches access token and uses it as Bearer', async () => {
    mockedAxiosPost.mockResolvedValueOnce({
      data: { access_token: 'jwt-token-123', expires_in: 300 },
    });
    mockedAxiosRequest.mockResolvedValue({
      data: { user: 'oidc-user' },
    });

    const link = new OIDCLink(
      new URL('https://pp-stage.engineering.redhat.com/api/v7'),
      oidcOptions
    );
    const result = await link.get('whoami');

    // Verify token endpoint was called with correct params
    expect(mockedAxiosPost).toHaveBeenCalledOnce();
    const [url, body, config] = mockedAxiosPost.mock.calls[0] as [
      string,
      URLSearchParams,
      Record<string, unknown>,
    ];
    expect(url).toBe('https://auth.example.com/token');
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(body.get('grant_type')).toBe('client_credentials');
    expect(body.get('client_id')).toBe('test-client');
    expect(body.get('client_secret')).toBe('test-secret');
    expect(config!.headers).toHaveProperty(
      'Content-Type',
      'application/x-www-form-urlencoded'
    );

    // Verify API request used the token
    const reqConfig = mockedAxiosRequest.mock.calls[0][0];
    expect(reqConfig.headers).toHaveProperty(
      'Authorization',
      'Bearer jwt-token-123'
    );
    expect(result).toEqual({ user: 'oidc-user' });
  });

  test('caches token for subsequent requests', async () => {
    mockedAxiosPost.mockResolvedValueOnce({
      data: { access_token: 'jwt-token-123', expires_in: 300 },
    });
    mockedAxiosRequest.mockResolvedValue({
      data: { ok: true },
    });

    const link = new OIDCLink(
      new URL('https://pp-stage.engineering.redhat.com/api/v7'),
      oidcOptions
    );

    await link.get('endpoint1');
    await link.get('endpoint2');

    // Token endpoint should only be called once
    expect(mockedAxiosPost).toHaveBeenCalledOnce();
    // API requests should be called twice
    expect(mockedAxiosRequest).toHaveBeenCalledTimes(2);
  });

  test('refreshes token when expired', async () => {
    mockedAxiosPost
      .mockResolvedValueOnce({
        data: { access_token: 'token-1', expires_in: 0 },
      })
      .mockResolvedValueOnce({
        data: { access_token: 'token-2', expires_in: 300 },
      });
    mockedAxiosRequest.mockResolvedValue({
      data: { ok: true },
    });

    const link = new OIDCLink(
      new URL('https://pp-stage.engineering.redhat.com/api/v7'),
      oidcOptions
    );

    await link.get('endpoint1');
    await link.get('endpoint2');

    // Token endpoint should be called twice (token expired immediately)
    expect(mockedAxiosPost).toHaveBeenCalledTimes(2);

    // Second request should use the new token
    const secondReqConfig = mockedAxiosRequest.mock.calls[1][0];
    expect(secondReqConfig.headers).toHaveProperty(
      'Authorization',
      'Bearer token-2'
    );
  });

  test('defaults expires_in to 300 when not provided', async () => {
    mockedAxiosPost.mockResolvedValueOnce({
      data: { access_token: 'jwt-token-123' },
    });
    mockedAxiosRequest.mockResolvedValue({
      data: { ok: true },
    });

    const link = new OIDCLink(
      new URL('https://pp-stage.engineering.redhat.com/api/v7'),
      oidcOptions
    );

    await link.get('endpoint1');
    await link.get('endpoint2');

    // Should still cache with default expiry
    expect(mockedAxiosPost).toHaveBeenCalledOnce();
  });
});

describe('KerberosLink', () => {
  test('follows redirect chain with SPNEGO and sends cookies', async () => {
    const kerberos = await import('kerberos');
    const mockClient = {
      step: vi.fn().mockResolvedValue(undefined),
      response: 'spnego-base64-token',
    };

    // SPNEGO fails for PP host, succeeds for auth server
    vi.mocked(kerberos.initializeClient).mockImplementation(
      async (service: string) => {
        if (service === 'HTTP@auth.example.com') {
          return mockClient as any;
        }
        throw new Error('LOOKING_UP_SERVER');
      }
    );

    mockedAxiosRequest
      // 1. POST /oidc/authenticate → 303 to auth server
      .mockResolvedValueOnce({
        status: 303,
        headers: {
          location: 'https://auth.example.com/auth?client_id=pp',
          'set-cookie': ['id=sess1; Path=/; HttpOnly'],
        },
        data: '',
      })
      // 2. GET auth server + Negotiate → 302 back to PP callback
      .mockResolvedValueOnce({
        status: 302,
        headers: {
          location:
            'https://pp-stage.engineering.redhat.com/oidc/callback?code=abc',
        },
        data: '',
      })
      // 3. GET PP callback → 200 + session cookies
      .mockResolvedValueOnce({
        status: 200,
        headers: {
          'set-cookie': [
            'sessionid=abc123; Path=/; HttpOnly',
            'csrftoken=xyz789; Path=/',
          ],
        },
        data: '',
      })
      // 4. API request (via performRequest)
      .mockResolvedValueOnce({
        data: { user: 'kerb-user' },
      });

    const link = new KerberosLink(
      new URL('https://pp-stage.engineering.redhat.com/api/v7')
    );
    const result = await link.get('whoami');

    // Verify SPNEGO was sent to auth server, not PP
    expect(mockClient.step).toHaveBeenCalledWith('');
    const authCall = mockedAxiosRequest.mock.calls[1][0];
    expect(authCall.headers).toHaveProperty(
      'Authorization',
      'Negotiate spnego-base64-token'
    );

    // Verify cookies are sent with API request
    const apiCall = mockedAxiosRequest.mock.calls[3][0];
    expect(apiCall.headers).toHaveProperty(
      'Cookie',
      'id=sess1; sessionid=abc123; csrftoken=xyz789'
    );
    expect(result).toEqual({ user: 'kerb-user' });
  });

  test('reuses session for subsequent requests', async () => {
    const kerberos = await import('kerberos');
    vi.mocked(kerberos.initializeClient).mockResolvedValue({
      step: vi.fn().mockResolvedValue(undefined),
      response: 'spnego-token',
    } as any);

    mockedAxiosRequest
      // Auth flow: single 200 response (no redirects)
      .mockResolvedValueOnce({
        status: 200,
        headers: { 'set-cookie': ['session=abc; Path=/'] },
        data: '',
      })
      // API calls
      .mockResolvedValueOnce({ data: { ok: true } })
      .mockResolvedValueOnce({ data: { ok: true } });

    const link = new KerberosLink(
      new URL('https://pp-stage.engineering.redhat.com/api/v7')
    );

    await link.get('endpoint1');
    await link.get('endpoint2');

    // Auth flow called once (1 request) + 2 API calls = 3 total
    expect(kerberos.initializeClient).toHaveBeenCalledOnce();
    expect(mockedAxiosRequest).toHaveBeenCalledTimes(3);
  });

  test('uses custom authenticate endpoint', async () => {
    const kerberos = await import('kerberos');
    vi.mocked(kerberos.initializeClient).mockResolvedValue({
      step: vi.fn().mockResolvedValue(undefined),
      response: 'spnego-token',
    } as any);

    mockedAxiosRequest
      .mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: '',
      })
      .mockResolvedValueOnce({ data: { ok: true } });

    const link = new KerberosLink(
      new URL('https://pp-stage.engineering.redhat.com/api/v7'),
      {
        type: 'kerberos',
        authenticateEndpoint: 'https://custom.example.com/auth',
      }
    );

    await link.get('whoami');

    const firstCall = mockedAxiosRequest.mock.calls[0][0];
    expect(firstCall.url).toBe('https://custom.example.com/auth');
  });

  test('works when no set-cookie headers are returned', async () => {
    const kerberos = await import('kerberos');
    vi.mocked(kerberos.initializeClient).mockResolvedValue({
      step: vi.fn().mockResolvedValue(undefined),
      response: 'spnego-token',
    } as any);

    mockedAxiosRequest
      .mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: '',
      })
      .mockResolvedValueOnce({ data: { ok: true } });

    const link = new KerberosLink(
      new URL('https://pp-stage.engineering.redhat.com/api/v7')
    );
    const result = await link.get('whoami');

    const apiCall = mockedAxiosRequest.mock.calls[1][0];
    expect(apiCall.headers).toHaveProperty('Cookie', '');
    expect(result).toEqual({ ok: true });
  });
});
