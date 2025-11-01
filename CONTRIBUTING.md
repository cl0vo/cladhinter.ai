# 🤝 Contributing to Cladhunter

Спасибо за интерес к проекту Cladhunter! Мы приветствуем вклад от сообщества.

## 🎯 Как помочь проекту

### 🐛 Сообщения об ошибках
- Используйте [GitHub Issues](https://github.com/cl0vo/cladhunter.ai/issues)
- Используйте шаблон Bug Report
- Включите максимум деталей: OS, browser, логи, скриншоты

### 💡 Предложения фич
- Используйте [GitHub Issues](https://github.com/cl0vo/cladhunter.ai/issues)
- Используйте шаблон Feature Request
- Опишите проблему, которую решает фича
- Предложите решение

### 🔧 Pull Requests
1. Fork репозиторий
2. Создайте ветку: `git checkout -b feature/amazing-feature`
3. Сделайте изменения
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Откройте Pull Request

## 📋 Development Guidelines

### Code Style

**TypeScript/JavaScript:**
- Используйте TypeScript для типизации
- Следуйте существующему стилю кода
- Используйте ESLint
- Комментируйте сложную логику

**React:**
- Функциональные компоненты + hooks
- Props должны быть типизированы
- Используйте существующие UI компоненты из `/components/ui`

**SQL:**
- Используйте prepared statements
- Добавляйте индексы для часто запрашиваемых полей
- Документируйте сложные запросы

### Naming Conventions

**Files:**
- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.tsx`
- Utils: `camelCase.ts`
- Config: `camelCase.ts`

**Variables:**
- Constants: `UPPER_SNAKE_CASE`
- Variables: `camelCase`
- React Components: `PascalCase`

**Database:**
- Tables: `snake_case` (plural)
- Columns: `snake_case`
- Primary keys: `id`
- Foreign keys: `table_id`

### Git Commit Messages

Используйте [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new partner reward system
fix: resolve cooldown timer issue
docs: update API documentation
style: format code with prettier
refactor: simplify user authentication
test: add tests for mining system
chore: update dependencies
```

### Testing

**Before submitting PR:**
- [ ] Тестируйте локально (frontend + backend)
- [ ] Проверьте, что миграции работают
- [ ] Убедитесь, что нет TypeScript ошибок
- [ ] Проверьте на mobile viewport

**Команды для тестирования:**
```bash
# Frontend
npm run dev

# Backend
cd server
npm run dev

# Database connection
npm run test

# Migrations
npm run migrate
```

## 🏗️ Architecture

### Frontend Structure
```
/components     # React компоненты
  /ui          # ShadCN компоненты (не модифицировать структуру!)
/hooks         # React hooks
/config        # Конфигурация
/utils         # Утилиты
/types         # TypeScript типы
```

### Backend Structure
```
/server
  index.js           # Express сервер
  migrate.js         # Миграции
  /database
    schema.sql       # SQL схема
```

### Database Schema
См. `server/database/schema.sql` для полной схемы.

## 🔐 Security

**Важно:**
- Никогда не коммитьте `.env` файлы
- Не включайте приватные ключи в код
- Используйте environment variables для секретов
- Validate all user input
- Используйте prepared statements

## 📚 Resources

### Documentation
- [README.md](./README.md) - Общая информация
- [NEON_SETUP.md](./NEON_SETUP.md) - Настройка БД
- [QUICK_START.md](./QUICK_START.md) - Быстрый старт
- [agent.md](./agent.md) - Контекст для разработки

### Tech Stack
- **Frontend:** React 18, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express, Neon PostgreSQL
- **Blockchain:** TON Connect

## 🎨 Design System

### Colors
- Background: `#0A0A0A`
- Text: `white`
- Accent: `#FF0033`
- Glass: `white/10` with backdrop blur

### Typography
**Важно:** Не добавляйте Tailwind классы для шрифтов без необходимости:
- ❌ `text-2xl`, `font-bold`, `leading-none`
- ✅ Используйте только если явно требуется

### Components
- Используйте ShadCN компоненты из `/components/ui`
- Используйте `GlassCard` для карточек
- Используйте Lucide React для иконок

## 🚀 Areas for Contribution

### High Priority
- [ ] Реальная интеграция рекламных сетей
- [ ] TON transaction webhook verification
- [ ] Referral system tracking
- [ ] Admin dashboard

### Medium Priority
- [ ] Redis caching layer
- [ ] Analytics improvements
- [ ] Achievement/badge system
- [ ] Leaderboard

### Nice to Have
- [ ] Улучшение UI/UX
- [ ] Дополнительные языки
- [ ] Dark/Light theme toggle
- [ ] PWA improvements

## 🐛 Known Issues

См. [GitHub Issues](https://github.com/cl0vo/cladhunter.ai/issues) для текущих проблем.

## 💬 Questions?

- 📧 Email: (добавьте свой email)
- 💬 [GitHub Discussions](https://github.com/cl0vo/cladhunter.ai/discussions)
- 🐛 [GitHub Issues](https://github.com/cl0vo/cladhunter.ai/issues)

## 📜 License

Вкладывая код в этот проект, вы соглашаетесь с лицензией MIT.

---

**Спасибо за вклад в Cladhunter!** 🚀
