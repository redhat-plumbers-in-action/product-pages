export interface OIDCAuthOptions {
  type: 'oidc';
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
}

export interface KerberosAuthOptions {
  type: 'kerberos';
  authenticateEndpoint?: string;
}

export interface ApiKeyAuthOptions {
  type: 'apiKey';
  apiKey: string;
}

export type AuthOptions =
  | OIDCAuthOptions
  | KerberosAuthOptions
  | ApiKeyAuthOptions;
