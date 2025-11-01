# ⚡ Быстрый старт за 5 минут

## 1️⃣ Клонируйте репозиторий

```bash
git clone https://github.com/cl0vo/cladhunter.ai.git
cd cladhunter.ai
```

## 2️⃣ Создайте базу данных в Neon

1. Зайдите на [neon.tech](https://neon.tech)
2. Нажмите **"Sign Up"** (через GitHub или Email)
3. Создайте новый проект **"cladhunter"**
4. Скопируйте **Connection String**

Он выглядит так:
```
postgresql://user:password@ep-xxx.region.aws.neon.tech/cladhunter?sslmode=require
```

## 3️⃣ Настройте Backend

```bash
cd server
npm install
```

Создайте файл `.env`:
```bash
cp .env.example .env
```

Откройте `server/.env` и вставьте ваш Connection String:
```env
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/cladhunter?sslmode=require
PORT=3001
ALLOWED_ORIGINS=http://localhost:5173
```

Запустите миграции:
```bash
npm run migrate
```

Должно появиться:
```
✅ Database migrations completed successfully!
```

Запустите сервер:
```bash
npm run dev
```

Должно появиться:
```
🚀 Cladhunter API Server running on port 3001
```

## 4️⃣ Настройте Frontend

Откройте **новый терминал** и вернитесь в корневую папку:
```bash
cd ..
npm install
```

Создайте файл `.env`:
```bash
cp .env.example .env
```

Откройте `.env`:
```env
VITE_API_URL=http://localhost:3001
```

Запустите приложение:
```bash
npm run dev
```

Откройте браузер:
```
http://localhost:5173
```

## 5️⃣ Готово! 🎉

Теперь вы можете:
- ✅ Нажать кнопку майнинга
- ✅ Зарабатывать монеты 🆑
- ✅ Смотреть статистику
- ✅ Покупать бусты (в demo режиме)

---

## 🐛 Что-то не работает?

### Сервер не запускается

**Проверьте DATABASE_URL:**
```bash
cd server
cat .env
```

Убедитесь, что строка подключения правильная.

### Frontend не видит API

**Проверьте, что сервер запущен:**
```bash
curl http://localhost:3001/health
```

Должно вернуть:
```json
{"status":"ok"}
```

### База данных пустая

**Запустите миграции заново:**
```bash
cd server
npm run migrate
```

---

## 📚 Дальше

- 📖 Полное руководство: [NEON_SETUP.md](./NEON_SETUP.md)
- 🔄 Миграция с Supabase: [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
- 🚀 Деплой: [README.md#-deployment](./README.md#-deployment)
- 💻 Для разработчиков: [agent.md](./agent.md)

---

## 💬 Помощь

Если возникли проблемы:
- 🐛 [Создайте issue](https://github.com/cl0vo/cladhunter.ai/issues)
- 💬 [Discussions](https://github.com/cl0vo/cladhunter.ai/discussions)

**Удачи!** 🚀
