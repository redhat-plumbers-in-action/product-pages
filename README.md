# Product Pages

[![npm version][npm-status]][npm] [![Tests][test-status]][test] [![Linters][lint-status]][lint] [![CodeQL][codeql-status]][codeql] [![codecov][codecov-status]][codecov]

[npm]: https://www.npmjs.com/package/product-pages
[npm-status]: https://img.shields.io/npm/v/product-pages

[test]: https://github.com/redhat-plumbers-in-action/product-pages/actions/workflows/tests.yml
[test-status]: https://github.com/redhat-plumbers-in-action/product-pages/actions/workflows/tests.yml/badge.svg

[lint]: https://github.com/redhat-plumbers-in-action/product-pages/actions/workflows/lint.yml
[lint-status]: https://github.com/redhat-plumbers-in-action/product-pages/actions/workflows/lint.yml/badge.svg

[codeql]: https://github.com/redhat-plumbers-in-action/product-pages/actions/workflows/codeql-analysis.yml
[codeql-status]: https://github.com/redhat-plumbers-in-action/product-pages/actions/workflows/codeql-analysis.yml/badge.svg

[codecov]: https://app.codecov.io/gh/redhat-plumbers-in-action/product-pages
[codecov-status]: https://codecov.io/github/redhat-plumbers-in-action/product-pages/branch/main/graph/badge.svg

Typesafe access to Red Hat's [Product Pages REST API](https://pp.engineering.redhat.com/api/v7/).

## Installation

```bash
npm install product-pages
```

For Kerberos authentication, also install the optional `kerberos` peer dependency:

```bash
npm install kerberos
```

## API

### Creating the API instance

```typescript
import ProductPagesAPI from 'product-pages';
```

#### No authentication (public endpoints only)

```typescript
const api = new ProductPagesAPI('https://productpages.redhat.com/api/v7');
```

#### OIDC client credentials (JWT)

Obtain a JWT access token automatically using the OAuth2 client credentials grant. The token is cached and refreshed automatically before expiry.

```typescript
const api = new ProductPagesAPI('https://pp.engineering.redhat.com/api/v7', {
  type: 'oidc',
  tokenEndpoint: 'https://auth.redhat.com/auth/realms/EmployeeIDP/protocol/openid-connect/token',
  clientId: process.env.OIDC_CLIENT_ID,
  clientSecret: process.env.OIDC_CLIENT_SECRET,
});
```

#### Kerberos (SPNEGO)

Authenticate using a Kerberos ticket. Requires the `kerberos` npm package and a valid Kerberos ticket (personal or service account).

```typescript
const api = new ProductPagesAPI('https://pp.engineering.redhat.com/api/v7', {
  type: 'kerberos',
});
```

You can optionally specify a custom authenticate endpoint:

```typescript
const api = new ProductPagesAPI('https://pp.engineering.redhat.com/api/v7', {
  type: 'kerberos',
  authenticateEndpoint: 'https://pp.engineering.redhat.com/oidc/authenticate',
});
```

#### API key (Bearer token)

Pass an API key directly as a Bearer token:

```typescript
// Using AuthOptions object
const api = new ProductPagesAPI('https://pp.engineering.redhat.com/api/v7', {
  type: 'apiKey',
  apiKey: 'your-api-key',
});

// Or pass the API key as a string (shorthand)
const api = new ProductPagesAPI('https://pp.engineering.redhat.com/api/v7', 'your-api-key');
```

### Get the current user

Documentation: [`GET /whoami`](https://productpages.redhat.com/api/v7/whoami/)

```typescript
const whoami: WhoamiResponse = await api.whoami();
const whoami: unknown = await api.whoami(false);
```

### Get the releases for a product

Documentation: [`GET /releases/<id_or_shortname>`](https://productpages.redhat.com/api/v7/releases/rhel-8.2.0)

```typescript
const releases: ReleasesResponse = await api.releases('rhel-8.2.0');
const releases: unknown = await api.releases('rhel-8.2.0', false);
```

### Get the schedules for a release

Documentation: [`GET /releases/<id_or_shortname>/schedule-tasks`](https://productpages.redhat.com/api/v7/releases/rhel-8.2.0/schedule-tasks)

```typescript
const schedules: ReleasesScheduleTasksResponse = await api.releasesScheduleTasks('rhel-8.2.0');
const schedules: ReleasesScheduleTasksResponse = await api.releasesScheduleTasks('rhel-8.2.0', {
  name__regex: '.*Special Event.*',
});
const schedules: unknown = await api.releasesScheduleTasks('rhel-8.2.0', false);
```

> [!TIP]
> You can use the following options to filter the schedule tasks:
>
> - `fields`: The fields to return. Defaults to all fields.
> - `search`: The search query.
> - `ordering`: The ordering of the schedules.
> - `name__regex`: The regex to filter the schedule tasks by name.

## Auth Options Types

The library exports TypeScript types for all authentication options:

```typescript
import type { AuthOptions, OIDCAuthOptions, KerberosAuthOptions, ApiKeyAuthOptions } from 'product-pages';
```

## Development

```bash
# Install dependencies
yarn install

# Build
yarn build

# Run unit tests
yarn test

# Run integration tests (requires credentials)
OIDC_CLIENT_ID=... OIDC_CLIENT_SECRET=... yarn test

# Format code
yarn format
```
