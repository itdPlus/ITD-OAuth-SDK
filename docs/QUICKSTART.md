# Quickstart

> 💡 **Для разработки**: Используй [тестовые токены](./DEV-TOKENS.md) — они работают локально и не требуют регистрации приложения.

## 1. Зарегистрируй приложение

Подай заявку на [портале разработчиков](https://dev.итд.tech) (временно недоступно, пишите в [лс канала](https://t.me/@itdStatus)).  
При регистрации укажи:

- **Название** — отображается пользователю на странице подтверждения
- **Описание** — кратко зачем приложению нужен доступ
- **URL домашней страницы** — например `https://games-itd.com`. На основе него автоматически строится адрес callback страницы: `https://games-itd.com/auth/callback` (её нужно создать, см. шаг 4)
- **Иконка приложения** — отображается рядом с названием при авторизации

После одобрения получишь:

```
client_id:     your-app-id
client_secret: your-secret   ← только на сервере, никогда во фронтенде
```

## 2. Установи пакет

Устанавливается в оба проекта — фронтенд и бэкенд:

```bash
npm install itd-oauth
# или
bun add itd-oauth
```

```ts
import { ITDOAuth } from "itd-oauth";          // на бэкенде
import { ITDOAuthClient } from "itd-oauth/client"; // на фронтенде
```

## 3. Фронтенд — запуск авторизации

```tsx
import { ITDOAuthClient } from "itd-oauth/client";

const itd = new ITDOAuthClient({
  clientId: "your-app-id",
  scope:    "users",
});

// Вешаем на свою кнопку — никакого UI от SDK
<MyButton onClick={async () => {
  const code = await itd.loginWithPopup();
  await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
}}>
  Войти через ИТД
</MyButton>
```

## 4. Страница-callback

Создай страницу по адресу `https://твой-домен.com/auth/callback`.  
Она получит `code` из URL и передаст его в popup:

```tsx
// pages/auth/callback.tsx
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function CallbackPage() {
  const [params] = useSearchParams();

  useEffect(() => {
    const code  = params.get("code");
    const state = params.get("state");
    const error = params.get("error");

    if (!window.opener) return;

    window.opener.postMessage(
      error
        ? { type: "itd_oauth_error", error }
        : { type: "itd_oauth_code", code, state },
      window.location.origin
    );
    window.close();
  }, []);

  return <div>Авторизация...</div>;
}
```

## 5. Бэкенд — обмен code на токен

```ts
import { Elysia, t } from "elysia";
import { ITDOAuth } from "itd-oauth";

const itd = new ITDOAuth({
  clientId:     "your-app-id",
  clientSecret: "your-secret",
});

new Elysia()
  .post("/api/auth", async ({ body, set }) => {
    const { token } = await itd.exchangeCode(
      body.code,
      { setHeader: (k, v) => { set.headers[k] = v; } }
    );
    // Сохрани token в свою сессию
    return { token };
  }, {
    body: t.Object({ code: t.String() }),
  });
```

## 6. Запросы к ИТД через прокси

Используй `proxy()` на своём бэкенде чтобы делать запросы к ИТД от имени пользователя.
Если токен истёк прямо во время запроса — передай `refreshConfig` и SDK обновит его автоматически:

```ts
const profile = await itd.proxy(
  token,
  "/users/me",
  {},
  {
    request,
    response: { setHeader: (k, v) => { set.headers[k] = v; } },
    onTokenRefreshed: (newToken) => { session.token = newToken; },
  }
);
```

## Хранение секретов

`client_secret` никогда не должен попасть в браузер. Правильная схема:

```
.env (бэкенд)
├── CLIENT_ID=your-app-id
└── CLIENT_SECRET=your-secret   ← только здесь
```

```ts
// ✅ Правильно — на бэкенде
const itd = new ITDOAuth({
  clientId:     process.env.CLIENT_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
});

// ❌ Неправильно — на фронтенде
const itd = new ITDOAuth({
  clientId:     "your-app-id",
  clientSecret: "your-secret", // виден в исходнике страницы
});
```

`ITDOAuthClient` (браузерный) принимает только `clientId` — секрета у него нет намеренно.

## 7. Хранение сессии и автообновление токена

Раздел 6 решает проблему истёкшего токена внутри одного запроса к ИТД API.
Но если пользователь просто сидит на странице без запросов — через 20 минут его JWT протухнет и он вылетит из аккаунта при следующем действии.

Чтобы этого не было — нужен роут рефреша на твоём сервере и периодическое обновление токена на фронтенде.

### Почему нельзя обновить токен из браузера

Refresh token хранится в `httpOnly` куке — JavaScript его не видит и не может отправить напрямую. Браузер передаёт куку автоматически только на **твой** сервер, а уже сервер проксирует её на OAuth бэкенд через `refreshToken()`.

### Схема работы

```
Браузер                   Твой сервер              OAuth бэкенд
   │                          │                         │
   │── POST /api/exchange ───>│                         │
   │                          │── exchangeCode() ──────>│
   │                          │<── JWT + Set-Cookie ────│  ← itd_oauth_refresh кука
   │<── JWT ──────────────────│                         │
   │                          │                         │
   │  (токен истекает)        │                         │
   │── POST /api/refresh ────>│  (кука едет автом.)     │
   │                          │── refreshToken() ──────>│
   │                          │<── новый JWT + кука ────│
   │<── новый JWT ────────────│                         │
```

### Реализация на Elysia

```ts
import { Elysia, t } from "elysia";
import { ITDOAuth } from "itd-oauth";

const itd = new ITDOAuth({
  clientId:     process.env.CLIENT_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
});

const REFRESH_COOKIE = "itd_oauth_refresh";
const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path:     "/",
  maxAge:   60 * 60 * 24 * 7, // 7 дней
};

new Elysia()
  // Обмен code на JWT — вызывается после loginWithPopup()
  .post("/api/exchange", async ({ body, cookie }) => {
    const serverResponse = {
      setHeader: (_: string, value: string) => {
        const match = value.match(/itd_oauth_refresh=([^;]+)/);
        if (match) cookie[REFRESH_COOKIE].set({ value: match[1], ...COOKIE_OPTS });
      },
    };

    const { token, expiresIn } = await itd.exchangeCode(body.code, serverResponse);
    return { token, expiresIn };
  }, {
    body: t.Object({ code: t.String() }),
  })

  // Обновление токена — вызывай за 30 сек до истечения JWT
  .post("/api/refresh", async ({ cookie, set }) => {
    const refreshValue = cookie[REFRESH_COOKIE].value;
    if (!refreshValue) { set.status = 401; return { error: "Unauthorized" }; }

    const mockRequest  = {
      headers: { get: (name: string) =>
        name === "cookie" ? `${REFRESH_COOKIE}=${refreshValue}` : null },
    };
    const mockResponse = {
      setHeader: (_: string, value: string) => {
        const match = value.match(/itd_oauth_refresh=([^;]+)/);
        if (match) cookie[REFRESH_COOKIE].set({ value: match[1], ...COOKIE_OPTS });
      },
    };

    const { token } = await itd.refreshToken(mockRequest, mockResponse);
    return { token };
  })

  // Выход — удаляем куку
  .post("/api/logout", ({ cookie }) => {
    cookie[REFRESH_COOKIE].remove();
    return { ok: true };
  });
```

### Автообновление на фронтенде

Планируй рефреш заранее — за 30 секунд до истечения токена:

```ts
function scheduleRefresh(exp: number, onRefresh: (token: string) => void) {
  const delay = Math.max(0, (exp - Math.floor(Date.now() / 1000) - 30)) * 1000;
  setTimeout(async () => {
    const res = await fetch("/api/refresh", { method: "POST", credentials: "include" });
    if (res.ok) {
      const { token } = await res.json();
      onRefresh(token);
      const { exp: newExp } = parseJwt(token);
      scheduleRefresh(newExp, onRefresh); // планируем следующий рефреш
    }
  }, delay);
}
```

### Восстановление сессии при загрузке страницы

При перезагрузке React-состояние сбрасывается, но кука остаётся. Вызывай `/api/refresh` сразу при монтировании:

```ts
useEffect(() => {
  fetch("/api/refresh", { method: "POST", credentials: "include" })
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data?.token) {
        setToken(data.token);
        scheduleRefresh(parseJwt(data.token).exp, setToken);
      }
    });
}, []);
```

Если кука истекла (7 дней) — `/api/refresh` вернёт 401 и пользователь увидит форму входа.
