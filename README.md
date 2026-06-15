![ИТД OAuth](./banner.png)

# ITD OAuth SDK

[![npm version](https://img.shields.io/npm/v/itd-oauth.svg?style=flat-flat&color=33cd56)](https://www.npmjs.com/package/itd-oauth)
[![npm downloads](https://img.shields.io/npm/dm/itd-oauth.svg?style=flat-flat&color=007ec6)](https://www.npmjs.com/package/itd-oauth)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Официальный SDK для авторизации через ИТД OAuth.

## Установка

```bash
npm install itd-oauth
# или
bun add itd-oauth
```

Устанавливается в оба проекта — фронтенд и бэкенд. Импортируй нужную часть:

```ts
import { ITDOAuth } from "itd-oauth";          // бэкенд
import { ITDOAuthClient } from "itd-oauth/client"; // фронтенд
```

## Документация

- [Quickstart](./docs/QUICKSTART.md) — первый рабочий вход за 5 минут
- [Серверный SDK](./docs/SERVER.md) — `ITDOAuth`: `exchangeCode`, `proxy`, `refreshToken`
- [Браузерный SDK](./docs/CLIENT.md) — `ITDOAuthClient`: `loginWithPopup`
- [Scope](./docs/SCOPES.md) — список прав и что они дают
- [Ошибки](./docs/ERRORS.md) — коды ошибок и как их обрабатывать
