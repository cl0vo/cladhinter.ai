# Changelog

Все значимые изменения в проекте Cladhunter будут задокументированы в этом файле.

## [2.0.0] - 2025-11-01

### 🎉 Крупные изменения

**Миграция на Neon PostgreSQL**
- ✅ Заменили Supabase Edge Functions на Express.js API
- ✅ Заменили KV Store на PostgreSQL таблицы
- ✅ Упростили аутентификацию (только анонимные пользователи)
- ✅ Добавили систему миграций базы данных
- ✅ Улучшили производительность запросов

### Added
- 📁 `/server` - Express.js API сервер
- 📄 `server/database/schema.sql` - SQL схема для PostgreSQL
- 📄 `server/migrate.js` - Скрипт миграций
- 📄 `NEON_SETUP.md` - Подробное руководство по настройке Neon
- 📄 `MIGRATION_GUIDE.md` - Гайд по миграции с Supabase
- 📄 `CHANGELOG.md` - Этот файл
- 🔧 PostgreSQL индексы для оптимизации
- 🔧 Автоматическое обновление `updated_at` через triggers

### Changed
- ♻️ `/utils/supabase/client.tsx` - Адаптирован для Neon API
- ♻️ `/hooks/useAuth.tsx` - Упрощен, убрана Supabase Auth
- ♻️ `/hooks/useApi.tsx` - Обновлен для работы с новым API
- ♻️ `README.md` - Обновлена документация
- ♻️ `agent.md` - Обновлен контекст разработки
- 🔄 API Base URL теперь настраивается через `.env`

### Removed
- ❌ Зависимость от Supabase Edge Functions
- ❌ Зависимость от Supabase Auth
- ❌ Зависимость от Supabase KV Store
- ❌ Deno runtime
- ❌ Hono framework

### Technical Details

**Backend Stack:**
- Node.js + Express.js
- @neondatabase/serverless
- PostgreSQL 15+

**Database Schema:**
- 6 tables: users, sessions, ad_watches, daily_watch_counts, orders, reward_claims
- Полная нормализация данных
- Foreign keys и constraints
- Оптимизированные индексы

**Backward Compatibility:**
- ✅ Все API endpoints остались идентичными
- ✅ Все React компоненты без изменений
- ✅ Та же бизнес-логика
- ✅ Те же типы данных

### Performance Improvements
- 🚀 Faster queries благодаря PostgreSQL индексам
- 🚀 Connection pooling в Neon
- 🚀 Serverless масштабирование
- 🚀 Уменьшена latency API запросов

---

## [1.0.0] - 2025-10-22

### Initial Release

**Основные фичи:**
- ✅ Mining система с просмотром рекламы
- ✅ Система бустов (5 уровней)
- ✅ TON Connect интеграция
- ✅ Партнерские награды
- ✅ Статистика и графики
- ✅ Telegram WebApp поддержка
- ✅ Мобильная оптимизация
- ✅ Dark theme UI

**Tech Stack:**
- React 18 + TypeScript
- Tailwind CSS v4.0
- Supabase (Edge Functions + KV Store)
- TON Connect
- Motion, Recharts, Shadcn/ui

---

## Формат версий

Проект следует [Semantic Versioning](https://semver.org/):

- **MAJOR** версия: несовместимые изменения API
- **MINOR** версия: новые функции с обратной совместимостью
- **PATCH** версия: баг-фиксы с обратной совместимостью

---

## Roadmap

### v2.1.0 (Планируется)
- [ ] Redis кэширование для улучшения производительности
- [ ] Webhook для автоматической верификации TON транзакций
- [ ] Admin панель для управления пользователями
- [ ] Реальная интеграция с рекламными сетями

### v2.2.0 (Планируется)
- [ ] Система рефералов с трекингом
- [ ] Leaderboard
- [ ] Achievement/Badge система
- [ ] Push уведомления

### v3.0.0 (Будущее)
- [ ] Социальная авторизация (Telegram, Google, etc.)
- [ ] Withdrawal система
- [ ] Multi-currency поддержка
- [ ] ML-based fraud detection

---

**Поддержка:** [github.com/cl0vo/cladhunter.ai/issues](https://github.com/cl0vo/cladhunter.ai/issues)
