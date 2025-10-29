# Cladhunter – Internal Developer Handbook (2025.10)

Гайд собран для разработчиков, которые работают с актуальной версией продукта (React/Vite frontend + Express/Postgres backend). Читайте перед любой правкой: здесь описана архитектура, командами, запреты и порядок деплоя.

---

## 1. Архитектура и стек

| Слой       | Технологии                                    | Хостинг |
|------------|-----------------------------------------------|---------|
| Frontend   | React 18, TypeScript, Vite, Tailwind, TonConnect UI | Vercel  |
| Backend    | Node 18, Express, Zod, pg, express-rate-limit | Render  |
| Database   | Neon PostgreSQL                               | Neon    |
| Shared     | TypeScript-конфиги ads/economy/partners       | –       |

Auth реализован через анонимные сессии: API выдаёт `userId` + `accessToken`, фронт обязан отправлять `Authorization: Bearer` и `X-User-ID`.

---

## 2. Структура репозитория

```
.
├── backend/
│   ├── src/config.ts           # окружение (HTTP, DB, CORS, rate-limit)
│   ├── src/db.ts               # пул pg + миграции (users, watch_logs, user_tokens…)
│   ├── src/routes.ts           # маршруты /api/*
│   └── src/services/           # бизнес-логика (authService, userService …)
├── frontend/
│   ├── App.tsx                 # входная точка (экраны Mining/Stats/Wallet)
│   ├── hooks/                  # useAuth, useApi, useUserData и т.д.
│   ├── components/             # UI + шадCN-обёртки (не менять имена)
│   └── utils/api/client.ts     # резолвер BACKEND URL + fetch обёртка
├── shared/config/              # общие конфиги ads/economy/partners
└── docs/DEPLOYMENT.md          # инструкция по деплою Vercel + Render + Neon
```

Supabase Edge функции, старые proof-script’ы и связанные директории удалены — любые упоминания Supabase устарели.

---

## 3. Быстрый старт (локально)

```bash
npm install                                # корень, поднимет workspaces
cp backend/.env.example backend/.env       # вписать DATABASE_URL, MERCHANT_WALLET и т.д.
cp frontend/.env.example frontend/.env     # переопределить VITE_BACKEND_URL при необходимости
npm run dev:backend                        # Express API на 4000
npm run dev:frontend                       # Vite dev server на 5173
```

`VITE_BACKEND_URL` не обязателен: фронт сам подставит `http://localhost:4000/api`, если переменная не указана.

---

## 4. API-гайд

### Аутентификация
1. `POST /api/auth/anonymous` → `{ userId, accessToken }`.
2. Все прочие запросы передают заголовки:
   - `Authorization: Bearer <accessToken>`
   - `X-User-ID: <userId>`
3. Токены хранятся в таблице `user_tokens`, обновляется `last_used_at`.

### Основные эндпоинты
| Метод | URL                         | Описание                       |
|-------|----------------------------|--------------------------------|
| POST  | `/api/auth/anonymous`      | Выдать анонимную сессию        |
| GET   | `/api/health`              | Health-check Render            |
| POST  | `/api/user/init`           | Инициализация пользователя     |
| GET   | `/api/user/balance`        | Баланс, текущий буст           |
| GET   | `/api/stats`               | Статистика, история просмотров |
| POST  | `/api/ads/complete`        | Учёт просмотра рекламы         |
| GET   | `/api/rewards/status`      | Статус партнёрских наград      |
| POST  | `/api/rewards/claim`       | Зачисление награды партнёра    |
| POST  | `/api/orders/create`       | Создать заказ буста            |
| POST  | `/api/orders/:id/confirm`  | Подтвердить оплату буста       |

Ответы типизированы в `frontend/types/index.ts`. Любые изменения API должны быть отражены там же.

---

## 5. Конвенции фронтенда

- Все запросы идут через `useApi` + `apiRequest`.
- Хук `useAuth` управляет сессией, не генерируйте ID вручную.
- Компоненты UI берём из `components/ui/*` (шадCN), структуру файлов не менять.
- Toast — `sonner`, иконки — `lucide-react`, анимации — `motion`.
- Tailwind-тема задаётся в `frontend/tailwind.config.ts` и `styles/globals.css`.
- Любые новые страницы придерживаются мобильного-first дизайна.

---

## 6. Конвенции бекенда

- Валидация входящих данных через `zod` (см. `backend/src/routes.ts`).
- Запросы в БД исключительно через `db.ts` (`query`, `withTransaction`).
- Новые таблицы добавлять в `runSchemaMigrations`.
- Rate limiting управляется `API_RATE_LIMIT_*` (конфиг уже подключён в `server.ts`).
- Логи — только `console` (Render сохраняет stdout/stderr).
- Ошибки возвращаем в формате `{ error: "message" }`.

---

## 7. Shared-конфиги

- `shared/config/ads.ts` – список рекламных креативов.
- `shared/config/economy.ts` – бусты, рейты, лимиты.
- `shared/config/partners.ts` – партнёрские кампании и награды.

Правки должны учитывать, что эти данные используются и фронтом, и бэком: не меняйте типы без синхронного обновления.

---

## 8. Предупреждения и запреты

**Запрещено:**
- Вносить обратно Supabase / Deno код — он больше не используется.
- Менять структуру `components/ui` и `shared/config` без обсуждения.
- Коммитить реальные `.env` (используйте `.env.example`).
- Добавлять нестабильные пакеты без согласования.
- Изменять логику сессий (анонимные токены) без обновления `useAuth` и `authService`.

**Осторожно:** таблицы создаются автоматически при старте API; на проде лучше применить миграции вручную (см. Deployment).

---

## 9. Тестирование и контроль качества

Автотестов нет — проверяем вручную:
1. `npm run dev:backend`, `npm run dev:frontend`.
2. Залогиниться (тон-коннект опционально, но кнопки должны работать).
3. Пройти флоу: запуск майнинга, начисление энергии, просмотр статистики, покупка буста (ручное подтверждение).
4. Проверить ограничения: лимит просмотров, cooldown, rate-limit (при необходимости).

Перед деплоем убедитесь, что README и docs не устарели.

---

## 10. Деплой (Vercel + Render + Neon)

Кратко:
1. **Neon** – создать базу, взять URL с `sslmode=require`.
2. **Render** – Web Service, build `npm install && npm run build:backend`, start `npm run start:backend`, скопировать env из `backend/.env.example`, health-check `/api/health`.
3. **Vercel** – build `npm run build:frontend`, output `frontend/dist`, задать `VITE_BACKEND_URL`.
4. После деплоя прогнать smoke-тест: `/api/health`, `/api/auth/anonymous`, один флоу watch → stats → reward.

Подробности, чек-листы, FAQ: `docs/DEPLOYMENT.md`.

---

## 11. Roadmap (актуальный)

- **TON**: автоматизировать проверку транзакций (webhook/tonapi).
- **Auth hardening**: подписывать `Telegram initData`, расширять rate-limit при необходимости.
- **Ads**: интегрировать реальную сеть / медиатор, добавить аналитику.
- **Admin**: панель управления партнёрами и контентом.

Каждый пункт требует обсуждения и планирования перед реализацией.

---

## 12. Контрольная памятка

- **npm install --workspaces** – первая команда после клона.
- Front на 5173, back на 4000 — используйте раздельные терминалы.
- Коммиты должны быть осмысленными, сводки — на английском (`feat: …`, `fix: …`).
- Pull request обязательно содержит описание изменений и шаги проверки.
- После мержа не забывайте обновлять агентские материалы (README, docs, этот файл).

Удачной разработки! Если возникают вопросы по архитектуре — сначала ищите ответ здесь или в `docs/DEPLOYMENT.md`, затем поднимайте обсуждение в канале проекта.
