# 📱 Mobile Optimization - Quick Start

## Готово к использованию! ✅

Cladhunter **полностью оптимизирован** для мобильных устройств и Telegram Web App. Ничего дополнительно настраивать не нужно.

---

## 🚀 Что уже работает

### Автоматически включено:

✅ **Адаптация под любой экран**  
✅ **Поддержка iPhone с вырезами** (notch, Dynamic Island)  
✅ **Telegram Web App интеграция**  
✅ **Haptic feedback** (вибрация при взаимодействиях)  
✅ **Полноэкранная реклама** (100dvh)  
✅ **Touch-оптимизированные кнопки** (56px)  

---

## 📱 Тестирование на телефоне

### Вариант 1: Через Telegram Bot

1. **Создайте бота через BotFather**
   ```
   /newapp
   Choose bot: @YourBot
   App title: Cladhunter
   URL: https://your-deployed-url.com
   Short name: cladhunter
   ```

2. **Откройте в Telegram**
   ```
   https://t.me/YourBot/cladhunter
   ```

3. **Всё работает автоматически!**
   - Приложение развернётся на весь экран
   - Вырезы и закругления учтены
   - Вибрация при кликах включена

### Вариант 2: Обычный браузер на телефоне

1. Откройте URL в Safari (iOS) или Chrome (Android)
2. Приложение адаптируется автоматически
3. Telegram-специфичные функции недоступны (вибрация), но всё остальное работает

---

## 🎬 Как выглядит реклама на мобильном

### Полноэкранный режим:

```
┌───────────────────┐
│ [Partner Name]    │ ← Не перекрывается notch
│                   │
│                   │
│   VIDEO (9:16)    │ ← Заполняет весь экран
│                   │
│                   │
│   [Progress Bar]  │
│ ▓▓▓▓▓░░░░░░░░░░░  │
│                   │
│ ┌───────────────┐ │
│ │🎁 CLAIM REWARD│ │ ← Не перекрывается home indicator
│ └───────────────┘ │
│ "Watch for 5s..." │
└───────────────────┘
```

### Когда кнопка появляется:

- ⏱️ Через **6 секунд** просмотра (картинка)
- 🎥 Когда **видео заканчивается** (видео)
- ✋ **Нельзя пропустить** раньше времени

---

## 🔧 Настройка (если нужно)

### Изменить время до кнопки Claim

```typescript
// /config/ads.ts
export const adConfig = {
  skipDelay: 6, // ← Измените на нужное (секунды)
  minViewDuration: 3,
  trackViews: true,
};
```

### Добавить новую рекламу

```typescript
// /config/ads.ts
export const partnerAds: AdCreative[] = [
  {
    id: 'partner_1',
    type: 'video', // или 'image'
    url: 'https://example.com/ad.mp4',
    partnerUrl: 'https://partner-site.com',
    partnerName: 'Partner Name',
    duration: 15, // только для видео
  },
  // Добавьте сюда новые
];
```

---

## 🐛 Проблемы и решения

### Реклама не на весь экран

**Проблема:** Видео не заполняет экран на некоторых устройствах  
**Решение:** Проверьте, что используется `100dvh`, а не `100vh`

```tsx
// ✅ Правильно (уже в коде)
height: '100dvh'

// ❌ Неправильно
height: '100vh'
```

### Кнопка перекрывается системными элементами

**Проблема:** Кнопка Claim под home indicator на iPhone  
**Решение:** Добавлены safe area insets (уже в коде)

```tsx
// ✅ Уже настроено
paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 16px, 16px)'
```

### Вибрация не работает

**Проблема:** Haptic feedback не срабатывает  
**Решение:** Работает только в Telegram Web App

```typescript
// Проверка окружения (автоматическая)
if (isTelegramWebApp()) {
  hapticFeedback('notification', 'success'); // ✅
} else {
  // Fallback - ничего не делаем
}
```

---

## 📊 Проверка работоспособности

### Telegram Web App Features:

Откройте консоль в DevTools:

```javascript
// Проверить, что Telegram обнаружен
window.Telegram?.WebApp

// Должно вернуть объект с:
// - ready() ✅
// - expand() ✅
// - HapticFeedback ✅
// - viewportHeight ✅
```

### Mobile Optimizations:

```javascript
// Проверить safe areas
getComputedStyle(document.documentElement)
  .getPropertyValue('env(safe-area-inset-top)');
// Должно вернуть "44px" на iPhone с notch

// Проверить viewport
window.innerHeight; // Старый способ
document.documentElement.clientHeight; // Новый (dvh)
```

---

## 🎯 Best Practices

### ✅ DO:

- Тестируйте на **реальных устройствах**, не только в эмуляторе
- Проверяйте на **разных моделях** iPhone (с/без notch)
- Тестируйте **в Telegram** и в обычном браузере
- Убедитесь, что кнопки **легко нажимаются пальцем**

### ❌ DON'T:

- Не полагайтесь только на desktop preview
- Не игнорируйте горизонтальную ориентацию
- Не делайте кнопки меньше 44px
- Не забывайте про медленный мобильный интернет

---

## 📚 Дополнительная информация

### Полная документация:

- 📖 **`MOBILE_OPTIMIZATION.md`** - Детальный гайд по мобильной оптимизации
- 🎨 **`AD_SYSTEM.md`** - Система рекламы
- ⚡ **`AD_QUICKSTART.md`** - Быстрый старт с рекламой

### Telegram Resources:

- [Telegram Mini Apps Docs](https://core.telegram.org/bots/webapps)
- [BotFather Commands](https://core.telegram.org/bots#botfather)
- [WebApp Changelog](https://core.telegram.org/bots/webapps#recent-changes)

---

## ✨ Готово!

Ваше приложение уже **полностью готово** для мобильных устройств и Telegram.

**Просто откройте на телефоне и проверьте!** 🚀

---

**Last Updated:** October 21, 2025  
**Version:** 1.1.0
