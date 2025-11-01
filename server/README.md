# Cladhunter API Server

Express.js API server для Cladhunter, использующий Neon Serverless PostgreSQL.

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
cd server
npm install
```

### 2. Настройка базы данных

Создайте проект в [Neon Console](https://console.neon.tech):

1. Зарегистрируйтесь на neon.tech
2. Создайте новый проект
3. Скопируйте Connection String

### 3. Конфигурация

Создайте файл `.env`:

```bash
cp .env.example .env
```

Отредактируйте `.env` и добавьте ваш DATABASE_URL:

```env
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/cladhunter?sslmode=require
PORT=3001
TON_MERCHANT_ADDRESS=UQD_your_ton_address
ALLOWED_ORIGINS=http://localhost:5173
```

### 4. Миграции

Запустите миграции для создания таблиц:

```bash
npm run migrate
```

### 5. Запуск сервера

Для разработки (с hot-reload):
```bash
npm run dev
```

Для продакшена:
```bash
npm start
```

Сервер запустится на `http://localhost:3001`

## 📁 Структура

```
server/
├── index.js              # Главный файл сервера
├── migrate.js            # Скрипт миграций
├── package.json          # Зависимости
├── .env.example          # Пример конфигурации
├── .env                  # Ваша конфигурация (не в git)
└── database/
    └── schema.sql        # SQL схема базы данных
```

## 🔌 API Endpoints

### Health Check
```
GET /health
```

### User Management
```
POST /user/init          # Инициализация пользователя
GET  /user/balance       # Получить баланс
```

### Ad System
```
POST /ads/complete       # Завершить просмотр рекламы
```

### Orders (TON Payments)
```
POST /orders/create             # Создать заказ
GET  /orders/:orderId           # Проверить статус
POST /orders/:orderId/confirm   # Подтвердить оплату
```

### Statistics
```
GET /stats               # Получить статистику
```

### Rewards
```
GET  /rewards/status     # Статус наград
POST /rewards/claim      # Забрать награду
```

## 🔐 Аутентификация

Все запросы должны включать заголовок:
```
X-User-ID: anon_1234567890_xxx
```

## 📊 База данных

### Таблицы

- **users** - пользователи и их балансы
- **sessions** - сессии логинов
- **ad_watches** - история просмотров рекламы
- **daily_watch_counts** - дневные лимиты
- **orders** - заказы на буст
- **reward_claims** - заявки на награды

### Схема

Полная схема находится в `database/schema.sql`

## 🌍 Деплой

### Vercel

1. Установите Vercel CLI:
```bash
npm i -g vercel
```

2. Деплой:
```bash
vercel
```

3. Добавьте переменные окружения в Vercel Dashboard

### Railway

1. Установите Railway CLI:
```bash
npm i -g @railway/cli
```

2. Деплой:
```bash
railway up
```

### Render

1. Подключите GitHub репозиторий
2. Выберите "Node.js" runtime
3. Build command: `cd server && npm install`
4. Start command: `cd server && npm start`
5. Добавьте переменные окружения

## 🔧 Разработка

### Добавление нового эндпоинта

```javascript
app.post('/your-endpoint', async (req, res) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Ваша логика здесь
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});
```

### Логирование

Все запросы логируются в консоль:
```
2025-11-01T12:00:00.000Z - POST /user/init
```

## 🐛 Troubleshooting

### Ошибка подключения к БД
```
Error: connection timeout
```
Решение: Проверьте DATABASE_URL в .env

### Порт занят
```
Error: Port 3001 is already in use
```
Решение: Измените PORT в .env

### CORS ошибки
```
Access to fetch has been blocked by CORS policy
```
Решение: Добавьте origin в ALLOWED_ORIGINS

## 📝 Лицензия

MIT
