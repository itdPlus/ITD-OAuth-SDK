# Серверный SDK

```ts
import { ITDOAuth } from "itd-oauth";
```

Устанавливается на **бэкенде**. Содержит `client_secret` — никогда не используй на фронтенде.

## Инициализация

```ts
const itd = new ITDOAuth({
  clientId:     "your-app-id",
  clientSecret: "your-secret",
});
```

`redirectUri` не нужен — сервер строит его автоматически из домена твоего приложения.

---

## `exchangeCode(code, serverResponse?)`

Меняет одноразовый code на JWT. Refresh token автоматически устанавливается в httpOnly cookie через `serverResponse`.

```ts
.post("/api/auth", async ({ body, set }) => {
  const { token, expiresIn } = await itd.exchangeCode(
    body.code,
    { setHeader: (k, v) => { set.headers[k] = v; } }
  );
  // Сохрани token в сессию
  return { token };
})
```

Передавай `serverResponse` — без него refresh cookie не попадёт к пользователю.
Refresh cookie нужен для последующего вызова `refreshToken()` — именно через него SDK
обновляет JWT без повторного входа пользователя. Если не передать `serverResponse` здесь,
то `refreshToken()` всегда будет падать с 401.

---

## `proxy(token, path, options?, refreshConfig?)`

Проксирует запрос к итд.com. Автоматически обновляет JWT если истёк — передавай `refreshConfig`:

```ts
// С авторефрешем (рекомендуется)
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

// GET с параметрами
const posts = await itd.proxy(token, "/posts", {
  query: { limit: "20", sort: "new" },
});

// POST без тела
await itd.proxy(token, `/posts/${id}/like`, { method: "POST" });

// POST с телом
await itd.proxy(token, "/posts", {
  method: "POST",
  body: { content: "Текст поста" },
});
```

Выбрасывает `ITDOAuthError` со статусом:
- `403` если scope не разрешает эндпоинт
- `401` если сессия отозвана в ИТД (`message: "session_revoked"`)

---

## `refreshToken(request, response?)`

Обновляет JWT вручную — нужен только если не используешь авторефреш в `proxy()`.
Refresh одноразовый, живёт 7 дней, при каждом использовании выдаётся новый (rolling).

```ts
try {
  const { token } = await itd.refreshToken(
    request,
    { setHeader: (k, v) => { set.headers[k] = v; } }
  );
  session.token = token;
} catch (err) {
  if (err instanceof ITDOAuthError && err.status === 401) {
    clearSession(); // Refresh истёк — просим войти заново
  }
}
```

---

## `decodeToken(token)` / `isTokenExpired(token)`

```ts
const payload = itd.decodeToken(token);
payload.sub       // userId на итд.com
payload.sid       // ID сессии
payload.scope     // ["users", "posts"]
payload.exp       // unix timestamp истечения

itd.isTokenExpired(token); // true / false
```

---

## `elysiaPlugin()`

Добавляет `itdUser` в контекст всех роутов.

```ts
const app = new Elysia()
  .use(await itd.elysiaPlugin())
  .get("/me", ({ itdUser }) => ({
    userId: itdUser.sub,
    scope:  itdUser.scope,
  }));
```

---

## `ITDOAuthError`

```ts
try {
  await itd.proxy(token, "/users/me");
} catch (err) {
  if (err instanceof ITDOAuthError) {
    err.message // текст ошибки
    err.status  // HTTP статус
  }
}
```

### Публичные и защищённые роуты

`elysiaPlugin()` вызывает `getUser()` при каждом запросе и кидает 401 если токена нет. Если нужны публичные роуты — не используй плагин глобально, применяй его только к нужным роутам через отдельный инстанс:

```ts
const authPlugin = await itd.elysiaPlugin();

const app = new Elysia()
  .get("/public", () => "доступно всем")
  .use(
    new Elysia()
      .use(authPlugin)
      .get("/me", ({ itdUser }) => ({ userId: itdUser.sub }))
      .get("/posts", ({ itdUser }) => getPosts(itdUser.sub))
  );
```
