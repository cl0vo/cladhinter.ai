# Deployment Playbook (Render + Vercel + Neon)

Пошаговый гайд для выката CladHunter на домен `https://cladhunter.app`. Используйте его вместе с `audit.md` (фазы 1, 6, 7) и `README.md` → «Deployment Basics». Каждый блок снабжён чеклистом — переносите результаты в release log.

---

## 0. Pre-flight Checklist

- [ ] Обновлены зависимости (`npm install --workspaces`).
- [ ] `backend/.env` и `frontend/.env` заполнены актуальными значениями.
- [ ] Neon база доступна, выполнена инициализация схемы.
- [ ] Render и Vercel проекты готовы к деплою (указаны переменные окружения).
- [ ] Подготовлен smoke test план (см. раздел 4).

---

## 1. Database (Neon)

1. Создайте project + database в Neon, включите pooled connection.
2. Скопируйте строку подключения и добавьте `sslmode=require`.
3. Заполните `backend/.env`:
   ```env
   DATABASE_URL=postgres://...neon.tech/neondb?sslmode=require
   ```
4. Запустите backend локально (`npm run dev:backend`) для автоматического bootstrap схемы или выполните миграции вручную, если появятся.
5. Проверьте наличие таблиц: `users`, `user_tokens`, `watch_logs`, `reward_claims`, `orders`, `session_logs`.
6. Настройте автоматические бэкапы и read-only доступ при необходимости.

---

## 2. Backend (Render Web Service)

| Настройка | Значение |
|-----------|----------|
| Environment | Node |
| Build command | `npm install && npm run build:backend` |
| Start command | `npm run start:backend` |
| Health check | `/api/health` |

### Переменные окружения

- `DATABASE_URL`
- `CORS_ALLOWED_ORIGINS` (например, `https://cladhunter.app,https://cladhunter.vercel.app`)
- `MERCHANT_WALLET`
- `TON_API_BASE_URL`, `TON_API_KEY`
- `TON_WEBHOOK_SECRET`
- `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_PROFILES_SAMPLE_RATE`
- `API_RATE_LIMIT_WINDOW_MS`, `API_RATE_LIMIT_MAX` (по необходимости)

### Чеклист

- [ ] Первый билд прошёл успешно, сервис получил публичный URL (`https://cladhunter-api.onrender.com`).
- [ ] Логи подтверждают, что `ensureDatabase()` или миграции выполнены.
- [ ] Webhook TonAPI зарегистрирован и указывает на `/api/payments/ton/webhook`.
- [ ] Проверены ручки `GET /api/health` и `GET /api/auth/ton-connect/challenge` из публичного интернета.
- [ ] Создана запись в release log о версии backend.

---

## 3. Frontend (Vercel)

| Настройка | Значение |
|-----------|----------|
| Build command | `npm run build:frontend` |
| Output directory | `frontend/dist` |
| Default domain | `https://cladhunter.vercel.app` (или кастомный CNAME) |

### Переменные окружения

- `VITE_BACKEND_URL=https://cladhunter-api.onrender.com` (или ваш Render URL)
- `VITE_SENTRY_DSN`, `VITE_SENTRY_TRACES_SAMPLE_RATE`

### Чеклист

- [ ] Указан workspace root при импорте репозитория (корень проекта).
- [ ] Успешно прошёл build preview.
- [ ] Проверено, что `VITE_BACKEND_URL` в build logs совпадает с актуальным Render URL.
- [ ] Custom домен `cladhunter.app` привязан и указывает на Vercel.
- [ ] Выполнены smoke тесты (раздел 4) на `https://cladhunter.app`.

---

## 4. Smoke Test Script

Прогоните после каждого релиза frontend/backend. Результаты фиксируйте в release log, ссылку на запись добавляйте в `audit.md` (Фаза 7).

1. `GET https://cladhunter-api.onrender.com/api/health` → `{ "status": "ok" }`.
2. TonConnect flow:
   - `GET /api/auth/ton-connect/challenge`
   - `POST /api/auth/ton-connect` (убедитесь, что backend и БД сохраняют `userId`, `walletAddress`, `accessToken`).
3. Mining:
   - Зайти на `https://cladhunter.app`, стартовать майнинг, дождаться завершения рекламы.
   - Проверить ответ `/api/ads/complete` (баланс обновился, cooldown работает).
4. Stats: обновление `/api/stats` показывает новую запись.
5. Partner Reward: `POST /api/rewards/claim`, проверить, что ID пропал из `/api/rewards/status`.
6. Boost:
   - `POST /api/orders/create`, получить comment payload.
   - Отправить TON (можно тестовой транзакцией), подтвердить через webhook или `POST /api/orders/:id/confirm`.
   - Проверить, что `/api/user/balance` отражает активный boost.
7. UI: убедиться, что Wallet отображает кошелёк, Stats — свежие данные, Withdraw помечен как WIP.

---

## 5. Troubleshooting

| Симптом | Действия |
|---------|----------|
| `POST /api/auth/ton-connect` зависает | Проверить Render logs, доступность Neon, наличие `TON_API_BASE_URL`. |
| Баланс не увеличивается | Убедиться, что `watch_logs` получает записи, кулдаун не блокирует, транзакция коммитится. |
| Webhook не приходит | Проверьте регистрацию на стороне TonAPI, заголовок `X-TON-WEBHOOK-SECRET`, сетевые логи Render. |
| Vercel обращается к старому API | Очистить `VITE_BACKEND_URL` в настройках, триггернуть rebuild. |
| Telegram WebApp не открывает `https://cladhunter.app` | Убедиться, что домен добавлен в `allowed_origins`, настроен HTTPS и корректный CNAME. |

---

## 6. Post-release Care

- [ ] Мониторинг `/api/health` и ключевых метрик добавлен в UptimeRobot/BetterStack.
- [ ] Сняты показатели (кол-во авторизаций, успешных майнингов, бустов) за первые 24 часа.
- [ ] Подготовлен ретроспективный отчёт (что починено, что осталось).
- [ ] Обновлены `audit.md` (чекбоксы фаз 6–7) и `README.md` (Changelog).
- [ ] Партнёры, маркетинг и команда уведомлены о статусе деплоя.

---

## История изменений

- 2025-10-31 — документ переработан в пошаговый playbook с чеклистами и smoke тестом.


