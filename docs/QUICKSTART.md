# Quickstart

## 1. Зарегистрируй приложение

Подай заявку на [портале разработчиков](https://dev.итд.tech).  
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

JWT живёт 20 минут. Передавай `refreshConfig` — SDK сам обновит токен когда нужно:

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

Готово.
