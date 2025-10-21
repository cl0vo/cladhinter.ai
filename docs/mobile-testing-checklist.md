# 📱 Mobile Testing Checklist

Используйте этот чек-лист для проверки мобильной оптимизации перед релизом.

---

## 🔧 Pre-Flight Checks

### Environment Setup
- [ ] Приложение развёрнуто на публичном URL (не localhost)
- [ ] HTTPS включен (required for Telegram Web App)
- [ ] Supabase Edge Functions работают
- [ ] TON Connect manifest доступен по URL

---

## 📱 Device Testing

### iOS Devices

#### iPhone SE (2020) - 375×667
- [ ] Реклама на весь экран
- [ ] Кнопка Claim видна и кликабельна
- [ ] Countdown отображается корректно
- [ ] Видео проигрывается автоматически
- [ ] Переход на сайт партнёра работает

#### iPhone 12/13/14 - 390×844 (Notch)
- [ ] Partner badge не перекрывается notch
- [ ] Кнопка Claim не перекрывается home indicator
- [ ] Safe area insets работают правильно
- [ ] Реклама заполняет экран без полос
- [ ] Прогресс-бар на правильной высоте

#### iPhone 14 Pro/15 Pro - 393×852 (Dynamic Island)
- [ ] Badge не под Dynamic Island
- [ ] Весь контент виден
- [ ] Кнопки в safe area

#### iPhone 14 Pro Max - 430×932
- [ ] Реклама масштабируется корректно
- [ ] Кнопка на всю ширину экрана
- [ ] Текст читаемый (не слишком большой)

### Android Devices

#### Samsung Galaxy S21 - 360×800
- [ ] Полноэкранный режим
- [ ] Кнопки достаточно большие
- [ ] Реклама центрирована
- [ ] Переходы плавные

#### Google Pixel 6 - 412×915
- [ ] Safe areas учтены
- [ ] Без обрезки контента

#### OnePlus, Xiaomi (различные)
- [ ] Вырезы камер учтены
- [ ] Навигация не перекрывается

---

## 🤖 Telegram Web App Testing

### Telegram iOS

#### Bot Setup
- [ ] Бот создан через @BotFather
- [ ] Web App добавлен с правильным URL
- [ ] Short name установлен
- [ ] Icon загружен (512×512)

#### Functionality
- [ ] Приложение открывается в Telegram
- [ ] `window.Telegram.WebApp` доступен
- [ ] `expand()` вызывается автоматически
- [ ] Приложение разворачивается на весь экран
- [ ] Header color = #0A0A0A
- [ ] Background color = #0A0A0A

#### Haptic Feedback
- [ ] Вибрация при клике на Claim
- [ ] Вибрация при завершении видео
- [ ] Вибрация на кнопках навигации (Mining/Stats/Wallet)

#### Links
- [ ] External links открываются в Safari/Chrome
- [ ] Не остаются в WebView
- [ ] После возврата приложение работает

### Telegram Android

#### Same as iOS
- [ ] Все пункты из iOS секции
- [ ] Учесть различия в вибрации (может быть слабее)

---

## 🎬 Ad Modal Specific Tests

### Video Ads

#### Playback
- [ ] Автоматически начинается воспроизведение
- [ ] Звук включен (не muted)
- [ ] `playsInline` работает (не fullscreen)
- [ ] Пауза не вызывается случайно
- [ ] Видео loop НЕ включен

#### UI Elements
- [ ] Прогресс-бар синхронизирован с видео
- [ ] Прогресс-бар красного цвета (#FF0033)
- [ ] Partner badge видно всё время
- [ ] Gradient overlay внизу

#### Countdown
- [ ] Показывается "Watch for Xs..."
- [ ] Цифра уменьшается каждую секунду
- [ ] При 0 появляется кнопка Claim
- [ ] Countdown исчезает после появления кнопки

#### Claim Button
- [ ] Появляется через 6 секунд
- [ ] Появляется раньше если видео короче 6 сек
- [ ] Анимация slide-up плавная
- [ ] Кнопка кликабельная
- [ ] Active state работает (scale 0.98)
- [ ] Иконка Gift отображается
- [ ] Текст "CLAIM REWARD" читаемый

### Image Ads

#### Display
- [ ] Картинка загружается
- [ ] Масштабируется правильно (object-cover)
- [ ] Соотношение сторон 9:16 сохраняется
- [ ] Качество изображения хорошее

#### UI Elements
- [ ] NO прогресс-бара (только для видео)
- [ ] Partner badge видно
- [ ] Gradient overlay видно
- [ ] Countdown работает (6 секунд)
- [ ] Кнопка Claim появляется

---

## 🔄 User Flows

### Happy Path
1. [ ] Пользователь открывает Mining экран
2. [ ] Нажимает "START MINING"
3. [ ] Открывается реклама (видео)
4. [ ] Видео играет 6 секунд
5. [ ] Появляется кнопка Claim
6. [ ] Пользователь нажимает Claim
7. [ ] Открывается сайт партнёра
8. [ ] Начинается майнинг
9. [ ] Монеты начисляются

### Edge Cases
- [ ] Быстрый двойной клик на Claim → не дублирует
- [ ] Выход из приложения во время рекламы → корректное восстановление
- [ ] Медленный интернет → loading state
- [ ] Видео не загрузилось → fallback
- [ ] Закрыть Telegram → при возврате состояние сохранено

---

## 🌐 Cross-Browser Testing

### Safari (iOS)
- [ ] Реклама отображается
- [ ] Видео автоплей работает
- [ ] Safe areas корректны
- [ ] 100dvh работает

### Chrome (Android)
- [ ] Всё как в Safari
- [ ] Address bar скрывается при scroll

### Telegram WebView
- [ ] Специфичные API работают
- [ ] External links корректны

---

## 🎨 Visual Quality

### Typography
- [ ] Шрифт Orbitron загружается
- [ ] Текст читаемый
- [ ] Uppercase текст не обрезается
- [ ] Tracking (letter-spacing) корректный

### Colors
- [ ] Красный цвет #FF0033 насыщенный
- [ ] Чёрный фон #0A0A0A глубокий
- [ ] Белый текст контрастный
- [ ] Shadow вокруг кнопки видна

### Animations
- [ ] Claim button slide-up плавная
- [ ] Active scale плавный
- [ ] Progress bar linear без рывков
- [ ] Fade in/out модалки

---

## ⚡ Performance

### Load Times
- [ ] Реклама открывается < 500ms
- [ ] Видео начинает грузиться сразу
- [ ] Первый кадр < 1s
- [ ] Полная загрузка видео в background

### Responsiveness
- [ ] Touch response instant
- [ ] Кнопки реагируют без задержки
- [ ] Animations 60 fps
- [ ] Нет janky scroll

### Memory
- [ ] Видео освобождается после закрытия
- [ ] Нет memory leaks
- [ ] Приложение не крашится после многих просмотров

---

## 🔐 Security & Privacy

### External Links
- [ ] `noopener` добавлен
- [ ] `noreferrer` добавлен
- [ ] Новая вкладка/окно открывается
- [ ] Origin не передаётся

### Data Protection
- [ ] User ID не утекает в URL
- [ ] Токены не в URL
- [ ] Личные данные не в logs

---

## 📊 Analytics & Tracking

### Events to Log
- [ ] Ad modal opened
- [ ] Ad view started
- [ ] Claim button appeared
- [ ] Claim button clicked
- [ ] Partner link opened
- [ ] Ad completed
- [ ] Coins credited

### Metrics to Track
- [ ] Time to claim
- [ ] Completion rate
- [ ] Drop-off points
- [ ] Device types
- [ ] Screen sizes

---

## 🐛 Known Issues to Check

### Common Problems
- [ ] iOS Safari video не автоплей → `playsInline` добавлен ✅
- [ ] Notch перекрывает контент → safe areas ✅
- [ ] 100vh неправильно → использую 100dvh ✅
- [ ] Кнопка под клавиатурой → fixed position ✅

### Regressions to Watch
- [ ] После обновления библиотек
- [ ] После изменений в CSS
- [ ] После добавления новых фич
- [ ] После обновления Telegram Web App API

---

## ✅ Pre-Launch Approval

### Final Checks Before Going Live

**Technical:**
- [ ] All tests passed on ≥3 real devices
- [ ] No console errors
- [ ] No network errors
- [ ] Performance acceptable

**UX:**
- [ ] Реклама выглядит профессионально
- [ ] Кнопки легко нажимать
- [ ] Текст читаемый
- [ ] Анимации приятные

**Business:**
- [ ] Partner links правильные
- [ ] Tracking работает
- [ ] Монетизация настроена
- [ ] Analytics подключены

---

## 📝 Notes Template

Use this to document issues found during testing:

```
Device: iPhone 14 Pro
OS: iOS 17.2
Browser: Telegram iOS 10.5
Issue: Badge slightly under Dynamic Island
Severity: Minor
Fix: Increase top margin from 12px to 16px
Status: Fixed
```

---

## 🚀 Sign-Off

**Tested by:** _________________  
**Date:** _________________  
**Devices Used:** _________________  
**All Critical Tests Passed:** ☐ Yes ☐ No  
**Ready for Production:** ☐ Yes ☐ No  

---

**Last Updated:** October 21, 2025  
**Version:** 1.1.0
