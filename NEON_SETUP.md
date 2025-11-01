# 🚀 Быстрый старт с Neon PostgreSQL

## Что такое Neon?

[Neon](https://neon.tech) - это serverless PostgreSQL база данных с автоскейлингом и моментальным деплоем. Идеально подходит для современных веб-приложений.

**Преимущества:**
- ✅ Serverless - платите только за использование
- ✅ Моментальное создание баз данных
- ✅ Автоматическое масштабирование
- ✅ Бесплатный план для разработки
- ✅ Совместимость с PostgreSQL

## 📝 Регистрация в Neon

### Шаг 1: Создайте аккаунт

1. Перейдите на [neon.tech](https://neon.tech)
2. Нажмите "Sign Up"
3. Зарегистрируйтесь через GitHub или Email

### Шаг 2: Создайте проект

1. В [Neon Console](https://console.neon.tech) нажмите "Create Project"
2. Введите имя проекта: `cladhunter`
3. Выберите регион (ближайший к вашим пользователям)
4. Нажмите "Create Project"

### Шаг 3: Получите Connection String

После создания проекта вы увидите Connection String:

```
postgresql://username:password@ep-xxx.region.aws.neon.tech/database_name?sslmode=require
```

**Скопируйте его!** Он понадобится для настройки.

## ⚙️ Настройка проекта

### 1. Установите зависимости сервера

```bash
cd server
npm install
```

### 2. Настройте переменные окружения

Создайте файл `server/.env`:

```bash
cd server
cp .env.example .env
```

Откройте `server/.env` и вставьте ваш Connection String:

```env
DATABASE_URL=postgresql://username:password@ep-xxx.region.aws.neon.tech/cladhunter?sslmode=require
PORT=3001
NODE_ENV=development
TON_MERCHANT_ADDRESS=UQD_your_ton_address_here
ALLOWED_ORIGINS=http://localhost:5173
```

### 3. Запустите миграции

Это создаст все необходимые таблицы в базе данных:

```bash
npm run migrate
```

Вы должны увидеть:
```
🔄 Running database migrations...
✅ Database migrations completed successfully!
📊 Tables created:
   - users
   - sessions
   - ad_watches
   - daily_watch_counts
   - orders
   - reward_claims
```

### 4. Запустите API сервер

```bash
npm run dev
```

Вы должны увидеть:
```
🚀 Cladhunter API Server running on port 3001
📊 Environment: development
🔗 Database: Connected
```

### 5. Настройте Frontend

Вернитесь в корневую папку проекта:

```bash
cd ..
```

Создайте `.env` файл:

```bash
cp .env.example .env
```

Откройте `.env` и укажите:

```env
VITE_API_URL=http://localhost:3001
VITE_TON_MERCHANT_ADDRESS=UQD_your_ton_address
```

### 6. Запустите Frontend

```bash
npm install  # Если еще не установили
npm run dev
```

Откройте [http://localhost:5173](http://localhost:5173)

## ✅ Проверка работы

### Тест 1: API Health Check

Откройте в браузере или используйте curl:

```bash
curl http://localhost:3001/health
```

Должен вернуть:
```json
{"status":"ok","timestamp":"2025-11-01T12:00:00.000Z"}
```

### Тест 2: Создание пользователя

Откройте приложение в браузере и нажмите кнопку майнинга.

Проверьте в Neon Console → SQL Editor:

```sql
SELECT * FROM users;
```

Вы должны увидеть вашего пользователя!

### Тест 3: Просмотр рекламы

1. Нажмите кнопку "START MINING"
2. Дождитесь окончания рекламы
3. Проверьте баланс - должен увеличиться на 10 🆑

Проверьте в базе данных:

```sql
SELECT * FROM ad_watches ORDER BY created_at DESC LIMIT 10;
```

### Тест 4: Статистика

Перейдите на вкладку "Stats" в приложении.

Вы должны увидеть:
- Total Earned: 10+
- Ads Watched: 1+
- Sessions: 1+

## 🗄️ Структура базы данных

### Таблица: users
Хранит информацию о пользователях и их балансах.

```sql
id                  TEXT      PRIMARY KEY
energy              INTEGER   Баланс монет 🆑
boost_level         INTEGER   Уровень буста (0-4)
last_watch_at       TIMESTAMP Последний просмотр рекламы
boost_expires_at    TIMESTAMP Когда истекает буст
created_at          TIMESTAMP Дата регистрации
updated_at          TIMESTAMP Последнее обновление
```

### Таблица: ad_watches
История просмотров рекламы.

```sql
id              SERIAL    PRIMARY KEY
user_id         TEXT      ID пользователя
ad_id           TEXT      ID рекламы
reward          INTEGER   Награда за просмотр
base_reward     INTEGER   Базовая награда
multiplier      DECIMAL   Множитель буста
created_at      TIMESTAMP Время просмотра
```

### Таблица: sessions
Трекинг логинов пользователей.

```sql
id          SERIAL    PRIMARY KEY
user_id     TEXT      ID пользователя
timestamp   TIMESTAMP Время логина
```

### Таблица: orders
Заказы на покупку бустов за TON.

```sql
id              TEXT      PRIMARY KEY
user_id         TEXT      ID пользователя
boost_level     INTEGER   Уровень буста
ton_amount      DECIMAL   Сумма в TON
status          TEXT      pending/paid/failed
payload         TEXT      Payload для транзакции
tx_hash         TEXT      Хеш транзакции TON
created_at      TIMESTAMP Время создания
updated_at      TIMESTAMP Последнее обновление
```

## 📊 Мониторинг в Neon Console

### SQL Editor

Выполняйте SQL запросы прямо в браузере:

```sql
-- Общая статистика
SELECT 
  COUNT(DISTINCT user_id) as total_users,
  COUNT(*) as total_watches,
  SUM(reward) as total_rewards
FROM ad_watches;

-- Топ пользователей
SELECT 
  user_id,
  energy,
  boost_level
FROM users 
ORDER BY energy DESC 
LIMIT 10;

-- Активность сегодня
SELECT COUNT(*) FROM ad_watches 
WHERE created_at > CURRENT_DATE;
```

### Monitoring

В Neon Console → Monitoring вы можете увидеть:
- CPU usage
- Memory usage
- Connection count
- Query performance

### Branches

Neon поддерживает ветки базы данных (как Git):
- Создайте ветку для тестирования
- Разрабатывайте без риска
- Мержите когда готово

## 🚢 Деплой в продакшен

### Backend на Railway

1. Установите Railway CLI:
```bash
npm install -g @railway/cli
```

2. Залогиньтесь:
```bash
railway login
```

3. Деплой:
```bash
cd server
railway up
```

4. Добавьте переменные окружения в Railway Dashboard:
   - `DATABASE_URL` - ваш Neon Connection String
   - `TON_MERCHANT_ADDRESS` - ваш TON адрес
   - `ALLOWED_ORIGINS` - URL вашего фронтенда

### Frontend на Vercel

1. Установите Vercel CLI:
```bash
npm install -g vercel
```

2. Деплой:
```bash
vercel
```

3. Добавьте переменные окружения в Vercel Dashboard:
   - `VITE_API_URL` - URL вашего Railway сервера
   - `VITE_TON_MERCHANT_ADDRESS` - ваш TON адрес

## 🔒 Безопасность

### Защита DATABASE_URL

**Никогда** не коммитьте `.env` файлы в Git!

Файл `server/.gitignore` уже настроен:
```
.env
.env.local
.env.production
```

### Ротация паролей

В Neon Console → Settings → Reset Password:
1. Сгенерируйте новый пароль
2. Обновите DATABASE_URL в `.env`
3. Перезапустите сервер

### IP Whitelist (опционально)

В Neon Console → Settings → IP Allow:
- Добавьте IP адреса для ограничения доступа

## 💰 Цены Neon

### Free Plan
- ✅ 1 проект
- ✅ 3 GB хранилища
- ✅ 10 GB трансфера в месяц
- ✅ Автоскейлинг до 1 GB RAM
- ✅ Идеально для разработки

### Pro Plan ($19/месяц)
- ✅ Неограниченно проектов
- ✅ 50 GB хранилища
- ✅ 100 GB трансфера
- ✅ Автоскейлинг до 4 GB RAM
- ✅ Point-in-time recovery

### Сколько это стоит для Cladhunter?

При 1000 активных пользователях в день:
- Storage: ~500 MB (в рамках Free Plan)
- Transfer: ~5 GB (в рамках Free Plan)

**Вывод:** Free Plan достаточно для начала!

## 🐛 Troubleshooting

### Ошибка: "Connection timeout"

**Причина:** Firewall блокирует соединение

**Решение:**
1. Проверьте, что `?sslmode=require` есть в DATABASE_URL
2. Попробуйте другую сеть (мобильный hotspot)
3. Проверьте IP Allow в Neon Console

### Ошибка: "relation does not exist"

**Причина:** Миграции не выполнились

**Решение:**
```bash
cd server
npm run migrate
```

### Ошибка: "too many connections"

**Причина:** Слишком много открытых соединений

**Решение:**
- Neon автоматически закрывает неактивные соединения
- В production используйте connection pooling

### База данных медленная

**Решение:**
1. Включите Connection Pooling в Neon Console
2. Добавьте индексы (уже есть в schema.sql)
3. Оптимизируйте запросы

## 📚 Дополнительные ресурсы

- [Neon Documentation](https://neon.tech/docs/introduction)
- [Neon GitHub](https://github.com/neondatabase)
- [PostgreSQL Tutorial](https://www.postgresqltutorial.com/)
- [SQL Cheat Sheet](https://www.postgresql.org/docs/current/sql-commands.html)

## 🎯 Следующие шаги

1. ✅ Настройте Neon
2. ✅ Запустите миграции
3. ✅ Проверьте работу локально
4. 🚀 Задеплойте в продакшен
5. 📊 Настройте мониторинг
6. 💰 Подключите реальные платежи TON

---

**Готово!** Теперь ваш Cladhunter работает с Neon PostgreSQL 🎉

Если возникли вопросы - проверьте [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
