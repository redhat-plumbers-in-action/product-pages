import {
  ApiKeyLink,
  PublicLink,
  OIDCLink,
  KerberosLink,
  ProductPagesLink,
} from './link';
import { isError } from './util';
import {
  ErrorResponse,
  errorResponseSchema,
  whoamiSchema,
  WhoamiResponse,
  releasesSchema,
  ReleasesResponse,
  releasesScheduleTasksSchema,
  ReleasesScheduleTasksResponse,
  ScheduleTasksQueryOptions,
} from './schema/api';
import {
  AuthOptions,
  OIDCAuthOptions,
  KerberosAuthOptions,
  ApiKeyAuthOptions,
} from './schema/auth';

export type {
  ErrorResponse,
  AuthOptions,
  OIDCAuthOptions,
  KerberosAuthOptions,
  ApiKeyAuthOptions,
  WhoamiResponse,
  ReleasesResponse,
  ReleasesScheduleTasksResponse,
  ScheduleTasksQueryOptions,
};

export { isError, errorResponseSchema };

export default class ProductPagesAPI {
  private readonly link: ProductPagesLink;

  constructor(instance: string, auth?: AuthOptions | string) {
    const url = new URL(instance);

    if (!auth) {
      this.link = new PublicLink(url);
    } else if (typeof auth === 'string') {
      // Backward compatibility: treat string as API key
      this.link = new ApiKeyLink(url, auth);
    } else {
      switch (auth.type) {
        case 'apiKey':
          this.link = new ApiKeyLink(url, auth.apiKey);
          break;
        case 'oidc':
          this.link = new OIDCLink(url, auth);
          break;
        case 'kerberos':
          this.link = new KerberosLink(url, auth);
          break;
        default: {
          const exhaustive: never = auth;
          throw new Error(
            `Unsupported auth type: ${(exhaustive as AuthOptions).type}`
          );
        }
      }
    }
  }

  async whoami(): Promise<WhoamiResponse>;
  async whoami(strict: boolean): Promise<unknown>;
  async whoami(strict?: boolean): Promise<unknown> {
    if (!this.isStrict(strict)) {
      return this.link.get('whoami');
    }

    return whoamiSchema.parse(await this.link.get('whoami'));
  }

  async releases(release: string): Promise<ReleasesResponse>;
  async releases(release: string, strict: boolean): Promise<unknown>;
  async releases(release: string, strict?: boolean): Promise<unknown> {
    const endpoint = `releases/${encodeURIComponent(release)}`;

    if (!this.isStrict(strict)) {
      return this.link.get(endpoint);
    }

    return releasesSchema.parse(await this.link.get(endpoint));
  }

  async releasesScheduleTasks(
    release: string
  ): Promise<ReleasesScheduleTasksResponse>;
  async releasesScheduleTasks(
    release: string,
    strict: boolean
  ): Promise<unknown>;
  async releasesScheduleTasks(
    release: string,
    options: ScheduleTasksQueryOptions
  ): Promise<ReleasesScheduleTasksResponse>;
  async releasesScheduleTasks(
    release: string,
    options: ScheduleTasksQueryOptions,
    strict: boolean
  ): Promise<unknown>;
  async releasesScheduleTasks(
    release: string,
    optionsOrStrict?: ScheduleTasksQueryOptions | boolean,
    strict?: boolean
  ): Promise<unknown> {
    const endpoint = `releases/${encodeURIComponent(release)}/schedule-tasks`;

    let options: ScheduleTasksQueryOptions | undefined;
    let strictMode: boolean | undefined;

    if (typeof optionsOrStrict === 'boolean') {
      strictMode = optionsOrStrict;
    } else {
      options = optionsOrStrict;
      strictMode = strict;
    }

    const data =
      options && Object.keys(options).length > 0
        ? await this.link.get(endpoint, options)
        : await this.link.get(endpoint);

    if (!this.isStrict(strictMode)) {
      return data;
    }

    return releasesScheduleTasksSchema.parse(data);
  }

  private isStrict(strict: boolean | undefined) {
    return strict === undefined || strict;
  }
}
