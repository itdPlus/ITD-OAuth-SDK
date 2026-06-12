import type { ITDClientConfig, ITDTokenPayload } from "./types.js";

export type { ITDClientConfig, ITDTokenPayload, ITDScope } from "./types.js";

const DEFAULT_OAUTH_URL = "https://auth.xn--d1ah4a.tech";
const POPUP_NAME        = "itd_oauth";
const POPUP_WIDTH       = 480;
const POPUP_HEIGHT      = 660;
const STATE_KEY         = "itd_oauth_state";

export class ITDOAuthClient {
  private clientId: string;
  private scope: string;
  private redirectUri?: string;

  constructor(config: ITDClientConfig) {
    this.clientId = config.clientId;
    this.scope    = config.scope;
    this.redirectUri = config.redirectUri;
  }

  loginWithPopup(): Promise<string> {
    return new Promise((resolve, reject) => {
      const state = this._generateState();
      sessionStorage.setItem(STATE_KEY, state);

      const params = new URLSearchParams({
        client_id: this.clientId,
        scope:     this.scope,
        state,
      });

      if (this.redirectUri) {
        params.set("redirect_uri", this.redirectUri);
      }

      const url = `${DEFAULT_OAUTH_URL}/oauth/authorize?${params}`;

      const left = Math.round(window.screenX + (window.outerWidth  - POPUP_WIDTH)  / 2);
      const top  = Math.round(window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2);

      const popup = window.open(
        url,
        POPUP_NAME,
        `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},resizable=no`
      );

      if (!popup) {
        reject(new ITDOAuthClientError("Popup was blocked by the browser", "popup_blocked"));
        return;
      }

      const onMessage = (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return;

        if (e.data?.type === "itd_oauth_error") {
          cleanup();
          reject(new ITDOAuthClientError("User denied access", "access_denied"));
          return;
        }

        if (e.data?.type !== "itd_oauth_code") return;

        const savedState = sessionStorage.getItem(STATE_KEY);
        if (e.data.state !== savedState) {
          cleanup();
          reject(new ITDOAuthClientError("State mismatch", "state_mismatch"));
          return;
        }

        cleanup();
        resolve(e.data.code as string);
      };

      const closedTimer = setInterval(() => {
        if (popup.closed) {
          cleanup();
          reject(new ITDOAuthClientError("Popup was closed by the user", "popup_closed"));
        }
      }, 500);

      function cleanup() {
        window.removeEventListener("message", onMessage);
        clearInterval(closedTimer);
        sessionStorage.removeItem(STATE_KEY);
        if (popup && !popup.closed) popup.close();
      }

      window.addEventListener("message", onMessage);
    });
  }

  decodeToken(token: string): ITDTokenPayload {
    const parts = token.split(".");
    if (parts.length !== 3) throw new ITDOAuthClientError("Invalid JWT format");
    try {
      const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(b64)) as ITDTokenPayload;
    } catch {
      throw new ITDOAuthClientError("Failed to decode JWT payload");
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

  private _generateState(): string {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
}

export class ITDOAuthClientError extends Error {
  public code: string;
  constructor(message: string, code = "unknown") {
    super(message);
    this.name = "ITDOAuthClientError";
    this.code = code;
  }
}
