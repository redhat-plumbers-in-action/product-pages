import axios, { AxiosRequestConfig } from 'axios';

import { OIDCAuthOptions, KerberosAuthOptions } from './schema/auth';

async function performRequest(config: AxiosRequestConfig): Promise<unknown> {
  try {
    const response = await axios.request({
      ...config,
      headers: {
        Accept: 'application/json',
        ...(config.headers ?? {}),
      },
    });

    return response.data;
  } catch (e: unknown) {
    if (axios.isAxiosError(e)) {
      throw new Error(JSON.stringify(e.response?.data));
    } else {
      throw e;
    }
  }
}

export type SearchParamValue = string | string[] | boolean | number;
export type SearchParams = Record<string, SearchParamValue | undefined>;

function serializeSearchParams(params: SearchParams): string {
  const serialized: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      serialized[key] = value.join(',');
    } else if (typeof value === 'boolean') {
      serialized[key] = value ? 'True' : 'False';
    } else {
      serialized[key] = String(value);
    }
  }

  return new URLSearchParams(serialized).toString();
}

export abstract class ProductPagesLink {
  constructor(protected readonly instance: URL) {}

  protected abstract request(config: AxiosRequestConfig): Promise<unknown>;

  protected buildURL(path: string): URL;
  protected buildURL<P extends SearchParams>(
    path: string,
    searchParams: P
  ): URL;
  protected buildURL<P extends SearchParams>(
    path: string,
    searchParams?: P
  ): URL {
    const url = new URL(`${this.instance.pathname}/${path}`, this.instance);

    if (searchParams) {
      url.search = serializeSearchParams(searchParams);
    }

    return url;
  }

  async get(path: string): Promise<unknown>;
  async get<P extends SearchParams>(
    path: string,
    searchParams: P
  ): Promise<unknown>;
  async get<P extends SearchParams>(
    path: string,
    searchParams?: P
  ): Promise<unknown> {
    const url = searchParams
      ? this.buildURL(path, searchParams)
      : this.buildURL(path);

    const config: AxiosRequestConfig = {
      url: url.toString(),
      method: 'GET',
    };

    return this.request(config);
  }

  async post<D>(path: string, data: D): Promise<unknown> {
    const config: AxiosRequestConfig<D> = {
      url: this.buildURL(path).toString(),
      method: 'POST',
      data,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    return this.request(config);
  }

  async delete<D>(path: string, data: D): Promise<unknown> {
    const config: AxiosRequestConfig = {
      url: this.buildURL(path).toString(),
      method: 'DELETE',
      data,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    return this.request(config);
  }
}

export class PublicLink extends ProductPagesLink {
  protected async request(config: AxiosRequestConfig): Promise<unknown> {
    return performRequest(config);
  }
}

/**
 * Handles authentication using an API key.
 */
export class ApiKeyLink extends ProductPagesLink {
  public constructor(
    instance: URL,
    private readonly apiKey: string
  ) {
    super(instance);
  }

  protected async request(config: AxiosRequestConfig): Promise<unknown> {
    return performRequest({
      ...config,
      headers: {
        ...(config.headers ?? {}),
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
  }
}

/**
 * Handles authentication using OIDC client credentials grant.
 * Automatically obtains and refreshes JWT access tokens.
 */
export class OIDCLink extends ProductPagesLink {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  public constructor(
    instance: URL,
    private readonly options: OIDCAuthOptions
  ) {
    super(instance);
  }

  private async fetchAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.accessToken && now < this.tokenExpiresAt) {
      return this.accessToken;
    }

    let response;
    try {
      response = await axios.post(
        this.options.tokenEndpoint,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.options.clientId,
          client_secret: this.options.clientSecret,
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        throw new Error(
          `OIDC token request failed: ${JSON.stringify(e.response?.data)}`
        );
      }
      throw e;
    }

    const token = response.data.access_token;
    if (typeof token !== 'string') {
      throw new Error('OIDC token response missing access_token');
    }

    this.accessToken = token;
    const expiresIn: number = Math.max(0, response.data.expires_in ?? 300);
    // Refresh 30 seconds before expiry
    this.tokenExpiresAt = now + (expiresIn - 30) * 1000;

    return this.accessToken;
  }

  protected async request(config: AxiosRequestConfig): Promise<unknown> {
    const token = await this.fetchAccessToken();

    return performRequest({
      ...config,
      headers: {
        ...(config.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });
  }
}

/**
 * Handles authentication using Kerberos/SPNEGO.
 *
 * Follows the OIDC redirect chain (like `curl --negotiate --location-trusted`):
 *   1. POST /oidc/authenticate → 303 to OIDC provider (e.g. auth.redhat.com)
 *   2. GET OIDC provider with SPNEGO Negotiate token → 302 back to /oidc/callback
 *   3. Follow remaining redirects, collecting session cookies
 */
export class KerberosLink extends ProductPagesLink {
  private cookies: string[] = [];
  private authenticated = false;
  private readonly authenticateEndpoint: string;

  public constructor(instance: URL, options?: KerberosAuthOptions) {
    super(instance);
    this.authenticateEndpoint =
      options?.authenticateEndpoint ??
      new URL('/oidc/authenticate', instance).toString();
  }

  private async negotiate(
    kerberos: typeof import('kerberos'),
    hostname: string
  ): Promise<string | null> {
    try {
      const client = await kerberos.initializeClient(`HTTP@${hostname}`);
      await client.step('');
      return client.response;
    } catch {
      return null;
    }
  }

  private async authenticate(): Promise<void> {
    if (this.authenticated) {
      return;
    }

    let kerberos: typeof import('kerberos');
    try {
      kerberos = await import('kerberos');
    } catch {
      throw new Error(
        'The "kerberos" package is required for Kerberos authentication. ' +
          'Install it with: npm install kerberos'
      );
    }

    this.cookies = [];

    let url = this.authenticateEndpoint;
    let method: string = 'POST';
    let lastStatus = 0;

    for (let i = 0; i < 10; i++) {
      const headers: Record<string, string> = {};

      if (this.cookies.length) {
        headers['Cookie'] = this.cookies.join('; ');
      }

      const token = await this.negotiate(kerberos, new URL(url).hostname);
      if (token) {
        headers['Authorization'] = `Negotiate ${token}`;
      }

      const response = await axios.request({
        url,
        method,
        data: method === 'POST' ? '' : undefined,
        maxRedirects: 0,
        validateStatus: status => status < 500,
        headers,
      });

      lastStatus = response.status;

      if (lastStatus >= 400) {
        throw new Error(
          `Kerberos authentication failed with status ${lastStatus}: ${JSON.stringify(response.data)}`
        );
      }

      const setCookieHeaders = response.headers['set-cookie'];
      if (setCookieHeaders) {
        for (const cookie of setCookieHeaders) {
          this.cookies.push(cookie.split(';')[0]);
        }
      }

      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.location
      ) {
        url = new URL(response.headers.location, url).toString();
        method = 'GET';
        continue;
      }

      break;
    }

    this.authenticated = true;
  }

  protected async request(config: AxiosRequestConfig): Promise<unknown> {
    await this.authenticate();

    return performRequest({
      ...config,
      headers: {
        ...(config.headers ?? {}),
        Cookie: this.cookies.join('; '),
      },
    });
  }
}
