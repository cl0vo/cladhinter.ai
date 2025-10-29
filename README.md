# Cladhunter

> Обновлённая watch-to-earn платформа: фронт на Vercel, API на Render, база в Neon.

---

## 🚀 Текущий стек

| Слой      | Технологии                              | Хостинг   |
|-----------|------------------------------------------|-----------|
| Frontend  | React 18, TypeScript, Vite, Tailwind     | Vercel    |
| Backend   | Node 18, Express, Zod, pg                | Render    |
| Database  | PostgreSQL                               | Neon      |
| Общие данные | `shared/config/*` (адсы, бусты, партнёры) | -       |

TonConnect подключается напрямую во фронте, API хранит экономику, статистику и покупки бустов.

---

## 📦 Структура репозитория

```
.
├── backend/                # Express API + доступ к Neon
│   ├── src/config.ts       # HTTP/DB/CORS настройки
│   ├── src/db.ts           # пул pg + миграции
│   ├── src/routes.ts       # REST-роуты (/api/*)
│   └── src/services/       # бизнес-логика (майнинг, бусты, награды)
├── frontend/               # Vite-приложение для Vercel
│   ├── App.tsx             # точка входа (экраны Mining/Stats/Wallet)
│   ├── hooks/              # работа с API и хранилищем пользователя
│   └── utils/api/client.ts # резолвинг BACKEND URL
├── shared/config/          # общая конфигурация (ads, economy, partners)
└── docs/DEPLOYMENT.md      # инструкция по деплою (Vercel + Render + Neon)
```

Удалён старый Supabase Edge backend, код Telegram-инициализации и тон-пруф обрабатываются внутри нового API.

---

## 🛠️ Локальная разработка

```bash
# 1. Установить зависимости
npm install

# 2. Настроить окружение
cp backend/.env.example backend/.env      # вписать DATABASE_URL и кошелёк
cp frontend/.env.example frontend/.env    # при необходимости переопределить URL API

# 3. Запустить backend (порт 4000)
npm run dev:backend

# 4. Запустить фронт (порт 5173)
npm run dev:frontend
```

Фронтенд автоматически подставит `http://localhost:4000/api` для запросов, если `VITE_BACKEND_URL` не задан.

---

## 🌐 API в двух словах

Все эндпоинты расположены под `/api`. Авторизация условная: фронт отправляет заголовок `X-User-ID` и произвольный `Authorization: Bearer {token}`.

| Метод | Эндпоинт                | Назначение                         |
|-------|-------------------------|------------------------------------|
| GET   | `/api/health`           | Проверка состояния сервиса         |
| POST  | `/api/user/init`        | Создать/инициализировать пользователя |
| GET   | `/api/user/balance`     | Энергия, буст, мультипликатор      |
| GET   | `/api/stats`            | Статистика по просмотрам           |
| POST  | `/api/ads/complete`     | Засчитать просмотр рекламы         |
| GET   | `/api/rewards/status`   | Полученные партнёрские награды     |
| POST  | `/api/rewards/claim`    | Выдать награду за партнёра         |
| POST  | `/api/orders/create`    | Создать заказ на буст              |
| POST  | `/api/orders/:id/confirm` | Подтвердить оплату буста         |

Структуры запросов/ответов представлены в `frontend/types/index.ts` и в сервисах `backend/src/services/userService.ts`.

---

## 🔐 Необходимые переменные окружения

**backend/.env**
```
DATABASE_URL=postgres://user:pass@host/db?sslmode=require
HOST=0.0.0.0
PORT=4000
CORS_ALLOWED_ORIGINS=https://cladhunter.vercel.app
MERCHANT_WALLET=UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ
```

**frontend/.env (опционально)**
```
VITE_BACKEND_URL=https://cladhunter-api.onrender.com
```

---

## 🚢 Деплой

1. **Neon** — создать базу, скопировать `DATABASE_URL` с `sslmode=require`.
2. **Render** — Web Service, build `npm install && npm run build:backend`, start `npm run start:backend`, прописать переменные окружения.
3. **Vercel** — build `npm run build:frontend`, output `frontend/dist`, указать `VITE_BACKEND_URL` на render-API.

Подробная пошаговая инструкция: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## 📋 TODO / дальнейшие шаги

- Проверка TON-транзакций по вебхукам вместо ручного подтверждения.
- Усиление авторизации: подписи Telegram initData и ограничение запросов.
- Подключение реальной рекламной сети и реферальной аналитики.

---

**Последнее обновление:** 29 октября 2025 г.  
**Статус:** mining & rewards работают; платёжная верификация в разработке.
