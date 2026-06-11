export interface ITDTokenPayload {
  sub: string;
  sid: string;
  clientId: string;
  scope: string[];
  iat: number;
  exp: number;
}

export type ITDScope =
  | "auth"
  | "users"
  | "posts"
  | "comments"
  | "notifications"
  | "files"
  | "reports"
  | "hashtags"
  | "search"
  | "subscription"
  | "verification"
  | "platform";

export interface ITDOAuthConfig {
  clientId: string;
  clientSecret: string;
  oauthUrl?: string;
}

export interface ITDClientConfig {
  clientId: string;
  scope: string;
  oauthUrl?: string;
}

export interface ITDTokenResponse {
  token: string;
}

export interface ITDProxyOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string>;
}
