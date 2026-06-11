# Ошибки

## Серверные — `ITDOAuthError`

```ts
import { ITDOAuth, ITDOAuthError } from "itd-oauth";

try {
  await itd.proxy(token, "/users/me");
} catch (err) {
  if (err instanceof ITDOAuthError) {
    err.message // текст
    err.status  // HTTP статус
  }
}
```

| Статус | Сообщение                      | Причина |
|--------|--------------------------------|---------|
| 400    | `Invalid code`                 | Code невалиден или уже использован |
| 400    | `Code expired`                 | Code истёк (живёт 1 минуту) |
| 400    | `Code not approved`            | Пользователь не подтвердил доступ |
| 400    | `redirect_uri mismatch`        | `redirectUri` не совпадает с зарегистрированным |
| 401    | `Invalid client credentials`   | Неверный `clientId` или `clientSecret` |
| 401    | `Missing refresh token cookie` | Refresh cookie отсутствует |
| 401    | `Invalid refresh token`        | Refresh token невалиден |
| 401    | `Refresh token expired`        | Refresh token истёк (7 дней без активности) |
| 401    | `session_revoked`              | Пользователь завершил сессию в ИТД |
| 403    | `Scope does not allow ...`     | Эндпоинт не разрешён выданным scope |
| 429    | `Too many login attempts`      | Rate limit — слишком много попыток входа |

## Браузерные — `ITDOAuthClientError`

| Код               | Причина |
|-------------------|---------|
| `popup_closed`    | Пользователь закрыл окно авторизации |
| `access_denied`   | Нажал "Запретить" |
| `state_mismatch`  | State не совпал — возможная CSRF атака |
| `popup_blocked`   | Браузер заблокировал popup |

## Обработка session_revoked

Когда пользователь завершает сессию в ИТД, следующий `proxy()` или `refreshToken()` вернёт 401 `session_revoked`. Разлогинь пользователя:

```ts
try {
  await itd.proxy(token, "/users/me", {}, { request, response, onTokenRefreshed });
} catch (err) {
  if (err instanceof ITDOAuthError && err.status === 401) {
    clearSession();
    redirect("/login");
  }
}
```

## Обработка истёкшего refresh token

Refresh token живёт 7 дней. После истечения `refreshToken()` вернёт 401. Пользователю нужно авторизоваться заново:

```ts
try {
  await itd.refreshToken(request, response);
} catch (err) {
  if (err instanceof ITDOAuthError && err.status === 401) {
    clearSession();
    redirect("/login");
  }
}
```
