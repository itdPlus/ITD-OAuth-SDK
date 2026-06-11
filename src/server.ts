import type { ITDOAuthConfig, ITDTokenPayload, ITDProxyOptions } from "./types.js";

export type { ITDOAuthConfig, ITDTokenPayload, ITDProxyOptions, ITDScope } from "./types.js";

const DEFAULT_OAUTH_URL = "https://auth.xn--d1ah4a.tech";

export class ITDOAuth {
  private clientId: string;
  private clientSecret: string;

  constructor(config: ITDOAuthConfig) {
    this.clientId     = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  getAuthorizationUrl(scope: string): { url: string; state: string } {
    const state = this._randomHex(16);
    const params = new URLSearchParams({
      client_id: this.clientId,
      scope,
      state,
    });
    return { url: `${DEFAULT_OAUTH_URL}/oauth/authorize?${params}`, state };
  }

  async exchangeCode(
    code: string,
    serverResponse?: { setHeader(name: string, value: string): void }
  ): Promise<{ token: string; expiresIn: number }> {
    const res = await fetch(`${DEFAULT_OAUTH_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id:     this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    const setCookie = res.headers.get("set-cookie");
    if (setCookie && serverResponse) {
      serverResponse.setHeader("Set-Cookie", setCookie);
    }

    const data = await res.json() as { token?: string; expires_in?: number; message?: string };
    if (!res.ok || !data.token) {
      throw new ITDOAuthError(data.message ?? `Token exchange failed: ${res.status}`, res.status);
    }

    return { token: data.token, expiresIn: data.expires_in ?? 1200 };
  }

  async refreshToken(
    incomingRequest: { headers: { get(name: string): string | null } },
    serverResponse?: { setHeader(name: string, value: string): void }
  ): Promise<{ token: string; expiresIn: number }> {
    const cookieHeader = incomingRequest.headers.get("cookie") ?? "";

    const res = await fetch(`${DEFAULT_OAUTH_URL}/oauth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        client_id:     this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    const setCookie = res.headers.get("set-cookie");
    if (setCookie && serverResponse) {
      serverResponse.setHeader("Set-Cookie", setCookie);
    }

    const data = await res.json() as { token?: string; expires_in?: number; message?: string };
    if (!res.ok || !data.token) {
      throw new ITDOAuthError(data.message ?? `Refresh failed: ${res.status}`, res.status);
    }

    return { token: data.token, expiresIn: data.expires_in ?? 1200 };
  }

  decodeToken(token: string): ITDTokenPayload {
    const parts = token.split(".");
    if (parts.length !== 3) throw new ITDOAuthError("Invalid JWT format");
    try {
      const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(b64)) as ITDTokenPayload;
    } catch {
      throw new ITDOAuthError("Failed to decode JWT payload");
    }
  }

  isTokenExpired(token: string): boolean {
    try {
      const { exp } = this.decodeToken(token);
      return Date.now() / 1000 > exp;
    } catch {
      return true;
    }
  }

  async proxy<T = unknown>(
    token: string,
    path: string,
    options: ITDProxyOptions = {},
    refreshConfig?: {
      request: { headers: { get(name: string): string | null } };
      response?: { setHeader(name: string, value: string): void };
      onTokenRefreshed?: (newToken: string) => void | Promise<void>;
    }
  ): Promise<T> {
    let activeToken = token;
    if (refreshConfig && this.isTokenExpired(token)) {
      const result = await this.refreshToken(refreshConfig.request, refreshConfig.response);
      activeToken = result.token;
      await refreshConfig.onTokenRefreshed?.(activeToken);
    }

    const { method = "GET", body, query } = options;

    let url = `${DEFAULT_OAUTH_URL}/proxy${path}`;
    if (query && Object.keys(query).length > 0) {
      url += "?" + new URLSearchParams(query).toString();
    }

    const res = await fetch(url, {
      method,
      headers: {
        Authorization:  `Bearer ${activeToken}`,
        "Content-Type": "application/json",
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });

    const data = await res.json() as T & { message?: string };
    if (!res.ok) {
      throw new ITDOAuthError(
        (data as { message?: string }).message ?? `Proxy request failed: ${res.status}`,
        res.status
      );
    }

    return data;
  }

  elysiaPlugin() {
    return async (app: import("elysia").Elysia) => {
      return app.derive(({ headers }) => {
        const getUser = (): ITDTokenPayload => {
          const auth = (headers as Record<string, string>)["authorization"] ?? "";
          if (!auth.startsWith("Bearer ")) throw new ITDOAuthError("Missing Bearer token", 401);
          return this.decodeToken(auth.slice(7));
        };
        return { itdUser: getUser() };
      });
    };
  }

  private _randomHex(bytes: number): string {
    const arr = new Uint8Array(bytes);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(arr);
    } else {
      const { randomFillSync } = require("crypto") as typeof import("crypto");
      randomFillSync(arr);
    }
    return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
}

export class ITDOAuthError extends Error {
  public status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ITDOAuthError";
    this.status = status;
  }
}
