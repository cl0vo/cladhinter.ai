# 🔄 Миграция с Supabase на Neon PostgreSQL

Это руководство поможет вам перенести Cladhunter с Supabase на Neon Serverless PostgreSQL.

## 📋 Что изменилось

### Backend
- ❌ **Удалено:** Supabase Edge Functions (Deno + Hono)
- ✅ **Добавлено:** Express.js API сервер (Node.js)
- ❌ **Удалено:** Supabase KV Store
- ✅ **Добавлено:** PostgreSQL таблицы в Neon
- ❌ **Удалено:** Supabase Auth
- ✅ **Осталось:** Анонимная аутентификация (anon_* IDs)

### Frontend
- ✅ Минимальные изменения
- ✅ Все компоненты остались без изменений
- ✅ API интерфейс идентичный

## 🚀 Шаги миграции

### 1. Настройка Neon Database

1. Зарегистрируйтесь на [Neon.tech](https://neon.tech)
2. Создайте новый проект
3. Скопируйте Connection String

```bash
postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/cladhunter?sslmode=require
```

### 2. Установка сервера

```bash
cd server
npm install
```

### 3. Конфигурация

Создайте файл `server/.env`:

```bash
cp server/.env.example server/.env
```

Заполните переменные:

```env
DATABASE_URL=postgresql://your-neon-connection-string
PORT=3001
NODE_ENV=development
TON_MERCHANT_ADDRESS=UQD_your_ton_address
ALLOWED_ORIGINS=http://localhost:5173
```

### 4. Запуск миграций

```bash
cd server
npm run migrate
```

Вы увидите:
```
✅ Database migrations completed successfully!
📊 Tables created:
   - users
   - sessions
   - ad_watches
   - daily_watch_counts
   - orders
   - reward_claims
```

### 5. Запуск API сервера

Для разработки:
```bash
npm run dev
```

Для продакшена:
```bash
npm start
```

### 6. Настройка Frontend

Создайте файл `.env` в корне проекта:

```bash
cp .env.example .env
```

Укажите URL API:

```env
VITE_API_URL=http://localhost:3001
VITE_TON_MERCHANT_ADDRESS=UQD_your_ton_address
```

### 7. Запуск Frontend

```bash
npm run dev
```

Приложение запустится на `http://localhost:5173`

## 📊 Сравнение схем данных

### Было (Supabase KV Store)

```typescript
// Key-Value пары
user:${userId}              → JSON
session:${userId}:${ts}     → JSON
watch:${userId}:${ts}       → JSON
watch_count:${userId}:date  → String
order:${orderId}            → JSON
reward_claim:${userId}:${partnerId} → JSON
```

### Стало (PostgreSQL Tables)

```sql
users (id, energy, boost_level, last_watch_at, boost_expires_at, created_at, updated_at)
sessions (id, user_id, timestamp)
ad_watches (id, user_id, ad_id, reward, base_reward, multiplier, created_at)
daily_watch_counts (user_id, date, count)
orders (id, user_id, boost_level, ton_amount, status, payload, tx_hash, created_at, updated_at)
reward_claims (id, user_id, partner_id, reward, claimed_at)
```

## 🔄 Миграция данных (опционально)

Если у вас есть данные в Supabase, которые нужно перенести:

### Экспорт из Supabase

```sql
-- В Supabase SQL Editor
SELECT * FROM kv_store_0f597298 WHERE key LIKE 'user:%';
```

Сохраните результаты в CSV.

### Импорт в Neon

Создайте скрипт миграции данных:

```javascript
// server/import-data.js
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function importUsers() {
  const sql = neon(process.env.DATABASE_URL);
  
  // Читаем CSV с пользователями
  const users = JSON.parse(fs.readFileSync('users-export.json', 'utf-8'));
  
  for (const user of users) {
    await sql`
      INSERT INTO users (id, energy, boost_level, last_watch_at, boost_expires_at, created_at, updated_at)
      VALUES (${user.id}, ${user.energy}, ${user.boost_level}, ${user.last_watch_at}, ${user.boost_expires_at}, ${user.created_at}, NOW())
      ON CONFLICT (id) DO NOTHING
    `;
  }
  
  console.log(`Imported ${users.length} users`);
}

importUsers();
```

Запустите:
```bash
node server/import-data.js
```

## 🚢 Деплой

### Вариант 1: Vercel (Frontend) + Railway (Backend)

**Frontend на Vercel:**
```bash
vercel
```

**Backend на Railway:**
```bash
railway up
```

Добавьте переменные окружения в Railway.

### Вариант 2: Render (Monorepo)

1. Подключите GitHub репозиторий
2. Создайте два сервиса:
   - **Web Service** (Frontend): Build command `npm run build`, Start `npm run preview`
   - **Web Service** (Backend): Build command `cd server && npm install`, Start `cd server && npm start`

### Вариант 3: Все на Vercel

**Backend как Serverless Functions:**

Создайте `api/[...path].js`:

```javascript
import app from '../server/index.js';

export default app;
```

Vercel автоматически превратит Express в serverless functions.

## ✅ Проверка миграции

### 1. Проверьте API
```bash
curl http://localhost:3001/health
# {"status":"ok","timestamp":"2025-11-01T..."}
```

### 2. Проверьте Frontend
Откройте `http://localhost:5173` и:
- ✅ Нажмите кнопку майнинга
- ✅ Посмотрите статистику
- ✅ Проверьте баланс

### 3. Проверьте базу данных
```sql
-- В Neon SQL Editor
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM ad_watches;
SELECT COUNT(*) FROM sessions;
```

## 🐛 Troubleshooting

### Ошибка "Connection timeout"
**Проблема:** Не удается подключиться к Neon
**Решение:** Проверьте DATABASE_URL, включите SSL mode

### Ошибка "CORS policy"
**Проблема:** Frontend не может обратиться к API
**Решение:** Добавьте URL фронтенда в ALLOWED_ORIGINS

### Ошибка "X-User-ID header missing"
**Проблема:** API не получает user ID
**Решение:** Проверьте, что useAuth() возвращает корректный ID

### Ошибка "Table does not exist"
**Проблема:** Миграции не выполнились
**Решение:** Запустите `npm run migrate` в папке server

## 📝 Что осталось без изменений

✅ Все React компоненты
✅ Все хуки (кроме useAuth)
✅ Вся бизнес-логика
✅ Все конфиги (economy.ts, partners.ts, ads.ts)
✅ Все UI компоненты
✅ TON Connect интеграция
✅ Telegram WebApp поддержка

## 📚 Дополнительные ресурсы

- [Neon Documentation](https://neon.tech/docs)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [PostgreSQL Tutorial](https://www.postgresql.org/docs/current/tutorial.html)

## 💬 Поддержка

Если возникли проблемы:
1. Проверьте логи сервера: `npm run dev` в папке server
2. Проверьте логи фронтенда: F12 в браузере
3. Проверьте подключение к Neon в консоли базы данных

---

**Готово!** Теперь ваш Cladhunter работает на Neon PostgreSQL 🎉
