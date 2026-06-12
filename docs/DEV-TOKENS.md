# Dev Tokens

Для разработки и тестирования доступны публичные тестовые токены. Они работают **только на localhost** с любыми портами.

## Тестовые данные

```
client_id:     itd-oauth-dev
client_secret: 5d00fa84920457ca2416db6776952da43b97ee79ad6346b47dce3b015f565e43
```

## Ограничения

- Работают **только** с доменами, начинающимися с `http://localhost:` (любой порт)
- При использовании на продакшене вернут ошибку `403 Forbidden`
- На всех страницах OAuth будет отображаться жёлтая плашка с предупреждением о режиме разработки

## Использование

### Фронтенд

**Важно**: Для dev-токенов параметр `redirectUri` **обязателен** и должен начинаться с `http://localhost:`:

```tsx
import { ITDOAuthClient } from "itd-oauth/client";

const itd = new ITDOAuthClient({
  clientId: "itd-oauth-dev",
  redirectUri: "http://localhost:5173/auth/callback",  // обязательно для dev-токенов
  scope: "users posts",
});

<button onClick={async () => {
  const code = await itd.loginWithPopup();
  await fetch("/api/auth", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}}>
  Войти через ИТД
</button>
```

**Любой порт работает**: `http://localhost:3000`, `http://localhost:5173`, `http://localhost:8080` и т.д.

### Бэкенд

```ts
import { ITDOAuth } from "itd-oauth";

const itd = new ITDOAuth({
  clientId: "itd-oauth-dev",
  clientSecret: "5d00fa84920457ca2416db6776952da43b97ee79ad6346b47dce3b015f565e43",
});

app.post("/api/auth", async (req, res) => {
  const { token } = await itd.exchangeCode(req.body.code, {
    setHeader: (k, v) => res.setHeader(k, v),
  });
  res.json({ token });
});
```

### Callback страница

Создай страницу по пути `/auth/callback` на своём порту (например `http://localhost:5173/auth/callback`):

```tsx
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function CallbackPage() {
  const [params] = useSearchParams();

  useEffect(() => {
    const code = params.get("code");
    const error = params.get("error");

    if (window.opener) {
      window.opener.postMessage(
        error ? { type: "itd_oauth_error", error } : { type: "itd_oauth_code", code },
        window.location.origin
      );
      window.close();
    }
  }, []);

  return <div>Авторизация...</div>;
}
```

## Переход на продакшен

Когда будете готовы к продакшену:

1. Зарегистрируй своё приложение на [портале](https://dev.итд.tech)
2. Получи production `client_id` и `client_secret`
3. Замени dev-токены на production токены в `.env`
4. **Удали параметр `redirectUri`** из `ITDOAuthClient` — для production приложений он строится автоматически из `home_url`

```tsx
// ❌ Dev (с redirectUri)
const itd = new ITDOAuthClient({
  clientId: "itd-oauth-dev",
  redirectUri: "http://localhost:5173/auth/callback",
  scope: "users posts",
});

// ✅ Production (без redirectUri)
const itd = new ITDOAuthClient({
  clientId: "your-production-client-id",
  scope: "users posts",
});
```

Dev-токены автоматически перестанут работать при попытке использования с production доменом.
