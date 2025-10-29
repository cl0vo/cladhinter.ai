# 🆑 Cladhunter

> **Cloud Mining Simulator & Watch-to-Earn для Telegram WebApp**  
> Смотри рекламу → зарабатывай внутриигровую валюту (🆑) → усиливай доход через бусты за TON.

![Version](https://img.shields.io/badge/version-1.1.0-red)
![React](https://img.shields.io/badge/React-18+-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue)
![Vercel](https://img.shields.io/badge/Frontend-Vercel-black)
![Render](https://img.shields.io/badge/Backend-Render-black)
![Neon](https://img.shields.io/badge/DB-Neon%20Postgres-green)
![TON](https://img.shields.io/badge/TON-Connect%20%2B%20ton--proof.js-blue)
![Telegram](https://img.shields.io/badge/Telegram-WebApp-179CDE)

---

## ✨ Что внутри

- 🎯 **Watch-to-Earn**: просмотр рекламы начисляет 🆑
- ⚡ **Бусты за TON**: повышают доход и включают авто-майнинг
- 📱 **Telegram WebApp**: нативные haptics, адаптация под мобильные
- 🪙 **TON Wallet Login**: авторизация через TonConnect + `ton-proof.js`
- 📊 **Статистика**: графики и история сессий
- 🔒 **Безопасность**: серверная верификация proof, лимиты и кулдауны
- 🚀 **Хостинг**: Front — Vercel, Back — Render, БД — Neon Postgres

---

## 🏗 Архитектура (актуальная)

```
Telegram WebApp (TWA)
        │ initData
        ▼
Frontend (React + TS, Vercel)
        │ TonConnect UI (wallet connect) + ton-proof.js
        ▼
Backend (Node/Express, Render)
        │ Верификация Telegram initData
        │ TON proof (wallet/nonce/signature)
        ▼
Database (Neon Postgres, Prisma)
```

**Ключевые потоки**
- **Auth**: `initData` (Telegram) → server verify → issue app session → (опционально) TON proof для привязки кошелька  
- **Earnings**: фронт дергает API → серверные лимиты/кулдауны → запись в БД  
- **Boosts**: покупка за TON → подтверждение/вебхук (todo) → апдейт множителя

---

## 🚀 Быстрый старт

### Локально

```bash
# 1) Установка
npm i

# 2) Переменные окружения
cp .env.example .env
# Заполни значения (см. ниже)

# 3) Миграции БД
npx prisma migrate dev

# 4) Запуск фронта и бэка (если монорепо — в соответствующих папках)
npm run dev
```

### Prod деплой
- **Frontend** → Vercel (env прокинуть через Project Settings)
- **Backend** → Render (Web Service, Node 18+; добавить env)
- **DB** → Neon (создать DB, выдать URL, SSL required)

---

## 🔧 Переменные окружения

### Общие
```
# Telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=...   # @your_bot
TELEGRAM_WEBAPP_URL=https://cladhunter-ai.vercel.app  # урл фронта

# App
APP_JWT_SECRET=supersecret
APP_PUBLIC_URL=https://your-backend.onrender.com
NODE_ENV=production
```

### Бэкенд (Render)
```
# Postgres (Neon)
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require

# Prisma (если используешь пулер/непуленное подключение)
POSTGRES_PRISMA_URL=postgresql://...pooler...neon.tech/neondb?sslmode=require
POSTGRES_URL_NON_POOLING=postgresql://...neon.tech/neondb?sslmode=require

# TON
TON_CONNECT_MANIFEST_URL=https://<frontend-domain>/.well-known/tonconnect-manifest.json
TON_PROOF_SALT=...   # для формирования/проверки payload'а
```

### Фронтенд (Vercel)
```
NEXT_PUBLIC_TG_BOT_NAME=your_bot
NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com
NEXT_PUBLIC_TON_MANIFEST_URL=https://<frontend-domain>/.well-known/tonconnect-manifest.json
```

---

## 🔌 API (пример)

```
POST /api/auth/telegram-init
  body: { initDataRaw }
  resp: { sessionJwt, user: { id, tgId, ... } }

POST /api/wallet/proof/start
  body: { sessionJwt }
  resp: { nonce, payload }  # для ton-proof.js

POST /api/wallet/proof/verify
  body: { sessionJwt, walletAddress, proof: { domain, payload, stateInit?, signature } }
  resp: { ok: true, wallet: { address }, userId }

POST /api/mining/complete
  body: { sessionJwt, adId }
  resp: { reward, total }
```

> ⚠️ Хэндлеры и названия у тебя могут отличаться — приведи к фактическим в проекте.

---

## 🧩 TON Connect + `ton-proof.js` (флоу)

1) Фронт: пользователь нажимает **Connect Wallet**  
2) Получаем **sessionJwt** после валидации `initData` (Telegram)  
3) `POST /wallet/proof/start` → сервер создает **nonce/payload**, сохраняет в БД (с привязкой к userId и TTL)  
4) Фронт вызывает `ton-proof.js` в TonConnect UI с `payload`  
5) Кошелек возвращает `proof` (подпись + payload)  
6) `POST /wallet/proof/verify` → сервер:
   - сверяет `nonce/payload` по userId и TTL  
   - валидирует подпись (по публичному ключу адреса)  
   - атомарно привязывает `walletAddress` к `userId`  
   - помечает запрос **использованным** (один раз!)  
7) Фронт обновляет состояние: кошелек **привязан**.

---

## 🧯 Траблшутинг: «ждет Proof», хотя кошелек уже привязан

1) **Идемпотентность на бэке**
   - `proof.verify` — один раз; при повторном вызове верни уже привязанный `walletAddress` и `status: "linked"`.
   - После успеха **инвалидируй nonce/payload**.

2) **Сигнал фронту**
   - Возвращай **полный user snapshot** после `verify` и снимай локальный флаг `waitingForProof`.
   - На события TonConnect (`onStatusChange`) делай `refetch()` пользователя.

3) **TTL/рассинхрон**
   - Просроченный nonce ломает цикл. Покажи таймер и при истечении делай новый `/proof/start`.

4) **Логи**
   - `[wallet-proof] start/verify` должны логировать `{ userId, wallet, ok }`.
   - `userId: null` в `start` → нет валидной сессии (чинить `/auth/telegram-init`).

---

## 📁 Структура проекта (пример)

```
/
├─ apps/
│  ├─ frontend/            # Vercel (React/TS/Tailwind)
│  └─ backend/             # Render (Node/Express, Prisma)
└─ packages/
   ├─ types/               # Общие типы
   └─ config/              # economy.ts, partners.ts, ads.ts
```

Ключевые файлы фронта:
- `hooks/useAuth.ts` — сессия (initData → JWT), user snapshot
- `hooks/useWallet.ts` — connect, proof.start/verify, состояние
- `config/economy.ts`, `config/partners.ts`, `config/ads.ts`

Ключевые файлы бэка:
- `routes/auth.ts` — верификация Telegram initData
- `routes/wallet.ts` — proof start/verify
- `routes/mining.ts` — начисления + лимиты
- `prisma/schema.prisma` — User, Wallet, Boost, Session, ProofRequest

---

## ⚙️ Экономика

| Параметр | Значение |
|---|---|
| 1 TON | 100,000 🆑 |
| Базовая награда за просмотр | 10–50 🆑 |
| Дневной лимит | 200 показов |
| Кулдаун | 30 сек |

**Бусты**

| Уровень | Название | Множитель | Цена | Срок |
|---|---|---:|---:|---:|
| 0 | Base | 1.0x | Free | — |
| 1 | Bronze | 1.25x | 0.3 TON | 7 дн |
| 2 | Silver | 1.5x | 0.7 TON | 14 дн |
| 3 | Gold | 2.0x | 1.5 TON | 30 дн |
| 4 | Diamond | 3.0x | 3.5 TON | 60 дн |

> Значения настраиваются в `config/economy.ts`.

---

## 🧪 Тестирование

```js
// В консоли фронта:
await window.testApi.testHealth()
await window.testApi.testUserInit()
await window.testApi.testCompleteAd('ad_1')
await window.testApi.simulateMining(5) // с кулдаунами
```

---

## 🔐 Безопасность

- Проверка **Telegram initData** на бэке (подпись и тайм-скью)
- Идемпотентные операции (proof, начисления)
- Лимиты/кулдауны на сервере
- JWT-сессии, короткие TTL для proof-nonce
- CORS/HTTPS везде (Render/Vercel/Neon — SSL)

---

## 🗺️ Roadmap

- ✅ MVP: майнинг, базовые бусты, Telegram WebApp, Postgres
- 🚧 TON: полноценная оплата бустов, вебхуки/квитование
- 📈 Ads: реальная сеть (AdMob/Unity/own mediation)
- 👥 Рефералка, дейли-бонусы, ачивки, лидерборды
- 🛠 Admin: дашборд, модерация креативов, аналитика

---

## 🤝 Contributing

1. Fork
2. `feat/your-feature`
3. PR с описанием
4. Покрыть кейсы и обновить доки

Гайд: код-стайл, типизация, мобильный QA.

---

## 📄 Лицензия

MIT — см. `LICENSE`.

---

## 🆘 Support

- **Issues**: GitHub Issues
- **Обсуждения**: GitHub Discussions
- **Логи**: Render (backend), Vercel (frontend), Neon (queries)
- **DevTools**: F12 → Network/Console

---

**Last Updated:** October 29, 2025  
**Status:** Production (Auth & Mining) / Payments (in progress)
