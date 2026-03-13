import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

import ProductPagesAPI from '../../src/index';

vi.mock('axios', async importOriginal => {
  const actual = (await importOriginal()) as typeof axios;

  return {
    ...actual,
    default: {
      ...actual,
      request: vi.fn(),
      isAxiosError: actual.isAxiosError,
    },
  };
});

vi.mock('kerberos', () => ({
  initializeClient: vi.fn(),
}));

const mockedAxiosRequest = vi.mocked(axios.request);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ProductPagesAPI.whoami', () => {
  describe('public', () => {
    const api = new ProductPagesAPI(
      'https://pp-stage.engineering.redhat.com/api/v7'
    );

    test('returns parsed response in strict mode (default)', async () => {
      mockedAxiosRequest.mockResolvedValue({
        data: { username: 'testuser' },
      });

      const result = await api.whoami();

      expect(result).toEqual({ username: 'testuser' });
      expect(mockedAxiosRequest).toHaveBeenCalledOnce();
      const config = mockedAxiosRequest.mock.calls[0][0];
      expect(config.url).toBe(
        'https://pp-stage.engineering.redhat.com/api/v7/whoami'
      );
      expect(config.method).toBe('GET');
    });

    test('rejects invalid response in strict mode', async () => {
      mockedAxiosRequest.mockResolvedValue({
        data: { unexpected: 'shape' },
      });

      await expect(api.whoami()).rejects.toThrow();
    });

    test('returns raw response in non-strict mode', async () => {
      const rawData = { username: 'testuser', extra: 'field' };
      mockedAxiosRequest.mockResolvedValue({
        data: rawData,
      });

      const result = await api.whoami(false);

      expect(result).toEqual(rawData);
    });
  });

  describe('kerberos', () => {
    const api = new ProductPagesAPI(
      'https://pp-stage.engineering.redhat.com/api/v7',
      { type: 'kerberos' }
    );

    test('authenticates via SPNEGO redirect flow and returns whoami', async () => {
      const kerberos = await import('kerberos');
      const mockClient = {
        step: vi.fn().mockResolvedValue(undefined),
        response: 'spnego-token',
      };
      vi.mocked(kerberos.initializeClient).mockImplementation(
        async (service: string) => {
          if (service === 'HTTP@auth.example.com') {
            return mockClient as any;
          }
          throw new Error('LOOKING_UP_SERVER');
        }
      );

      mockedAxiosRequest
        // Auth: POST /oidc/authenticate → redirect to auth server
        .mockResolvedValueOnce({
          status: 303,
          headers: { location: 'https://auth.example.com/auth' },
          data: '',
        })
        // Auth: GET auth server → redirect back with cookies
        .mockResolvedValueOnce({
          status: 302,
          headers: {
            location:
              'https://pp-stage.engineering.redhat.com/oidc/callback?code=x',
          },
          data: '',
        })
        // Auth: GET callback → 200 with session cookies
        .mockResolvedValueOnce({
          status: 200,
          headers: {
            'set-cookie': ['sessionid=abc123; Path=/; HttpOnly'],
          },
          data: '',
        })
        // API: GET whoami
        .mockResolvedValueOnce({
          data: { username: 'kerb-user' },
        });

      const result = await api.whoami();

      expect(result).toEqual({ username: 'kerb-user' });

      const apiCall = mockedAxiosRequest.mock.calls[3][0];
      expect(apiCall.url).toBe(
        'https://pp-stage.engineering.redhat.com/api/v7/whoami'
      );
      expect(apiCall.headers).toHaveProperty('Cookie', 'sessionid=abc123');
    });
  });
});
