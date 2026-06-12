# Браузерный SDK

```ts
import { ITDOAuthClient } from "itd-oauth/client";
```

Устанавливается на **фронтенде**. Не требует `clientSecret`.

## Инициализация

```ts
const itd = new ITDOAuthClient({
  clientId: "your-app-id",
  scope:    "users posts",
});
```

`redirectUri` указывать не нужно — сервер строит его автоматически из домена твоего приложения. Тебе нужно только создать страницу `/auth/callback` (см. ниже).

---

## `loginWithPopup()`

Открывает popup авторизации на `auth.xn--d1ah4a.tech`. Возвращает Promise с одноразовым `code`.
SDK не навязывает никакого UI — вешай на любой свой элемент:

```tsx
// React
<MyButton onClick={async () => {
  const code = await itd.loginWithPopup();
  await sendCodeToServer(code);
}}>
  Войти через ИТД
</MyButton>

// Vue
<MyButton @click="async () => {
  const code = await itd.loginWithPopup();
  await sendCodeToServer(code);
}">
  Войти через ИТД
</MyButton>

// Vanilla JS
document.querySelector("#btn").addEventListener("click", async () => {
  const code = await itd.loginWithPopup();
  await sendCodeToServer(code);
});
```

> Вызывай только в обработчике пользовательского события (клик).
> Вызов вне обработчика может быть заблокирован браузером.

**Обработка ошибок:**
```ts
try {
  const code = await itd.loginWithPopup();
} catch (err) {
  if (err instanceof ITDOAuthClientError) {
    switch (err.code) {
      case "popup_closed":  /* закрыл окно */ break;
      case "access_denied": /* нажал "Запретить" */ break;
      case "popup_blocked": /* браузер заблокировал */ break;
    }
  }
}
```

---

## `decodeToken(token)`

Читает данные из JWT на клиенте. Не верифицирует подпись.

```ts
const payload = itd.decodeToken(token);
payload.sub    // userId
payload.scope  // ["users", "posts"]
payload.exp    // unix timestamp истечения
```

---

## `isTokenExpired(token)`

```ts
if (itd.isTokenExpired(token)) {
  // попросить сервер обновить токен
}
```

---

## Страница-callback

Создай страницу по адресу `https://твой-домен.com/auth/callback`.  
Она получает `code` из URL и передаёт его в popup:

```tsx
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function ITDCallbackPage() {
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

---

## `ITDOAuthClientError`

| Код               | Причина |
|-------------------|---------|
| `popup_closed`    | Пользователь закрыл окно |
| `access_denied`   | Нажал "Запретить" |
| `state_mismatch`  | State не совпал — возможная CSRF атака |
| `popup_blocked`   | Браузер заблокировал popup |

---

## Параметр `oauthUrl`

По умолчанию клиент обращается к `https://auth.xn--d1ah4a.tech`. Менять не нужно.

Если поднимаешь собственный OAuth сервер (например для локальных тестов):

```ts
const itd = new ITDOAuthClient({
  clientId: "your-app-id",
  scope:    "users",
  oauthUrl: "http://localhost:3000",
});
```
