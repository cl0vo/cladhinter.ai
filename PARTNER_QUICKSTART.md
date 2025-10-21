# 🚀 Partner & Ads Quick Reference

**Быстрое добавление партнёров и рекламы в Cladhunter**

---

## 📱 Добавить Telegram канал

Откройте `/config/partners.ts` и добавьте:

```typescript
{
  id: 'telegram_your_channel',
  platform: 'telegram',
  name: 'Ваш Канал',
  username: '@yourchannel',
  url: 'https://t.me/yourchannel',
  reward: 750,
  description: 'Описание канала',
  icon: '📢',
  active: true,
}
```

---

## 🐦 Добавить X (Twitter) аккаунт

Откройте `/config/partners.ts` и добавьте:

```typescript
{
  id: 'x_your_account',
  platform: 'x',
  name: 'Ваш X',
  username: '@youraccount',
  url: 'https://x.com/youraccount',
  reward: 600,
  description: 'Описание аккаунта',
  icon: '🐦',
  active: true,
}
```

---

## 🎬 Добавить видео рекламу

Откройте `/config/ads.ts` и добавьте:

```typescript
{
  id: 'your_video_ad',
  type: 'video',
  url: 'https://cdn.yoursite.com/video.mp4',
  partnerUrl: 'https://yoursite.com',
  partnerName: 'Your Product',
  duration: 15,
}
```

**Требования к видео:**
- Формат: MP4
- Протокол: HTTPS
- Рекомендуемое соотношение: 9:16 (вертикальное для мобильных)

---

## 🖼️ Добавить баннер рекламу

Откройте `/config/ads.ts` и добавьте:

```typescript
{
  id: 'your_image_ad',
  type: 'image',
  url: 'https://cdn.yoursite.com/banner.jpg',
  partnerUrl: 'https://yoursite.com',
  partnerName: 'Your Brand',
}
```

**Требования к изображению:**
- Формат: JPG, PNG
- Протокол: HTTPS
- Рекомендуемое соотношение: 9:16 (1080x1920px)

---

## 💰 Рекомендуемые награды

| Тип партнёра | Награда |
|-------------|---------|
| Малый канал (< 1K) | 500 🆑 |
| Средний канал (1K-10K) | 700 🆑 |
| Большой канал (10K-100K) | 900 🆑 |
| Официальный/VIP | 1000 🆑 |

---

## 🔧 Временно отключить партнёра

Измените `active: true` на `active: false`:

```typescript
{
  id: 'telegram_test',
  // ... другие поля ...
  active: false, // ← Партнёр скрыт
}
```

---

## ✅ Проверка после добавления

1. Сохраните файл `/config/partners.ts` или `/config/ads.ts`
2. Перезагрузите приложение
3. Проверьте:
   - ✅ Партнёр/реклама отображается
   - ✅ Ссылка открывается корректно
   - ✅ Награда начисляется (для партнёров)
   - ✅ Нет ошибок в консоли

---

## 🆘 Troubleshooting

**Партнёр не отображается?**
- Убедитесь что `active: true`
- Проверьте синтаксис (запятые, кавычки)
- Перезагрузите страницу

**Реклама не загружается?**
- Проверьте URL (должен быть доступен)
- Убедитесь что используется HTTPS
- Откройте консоль (F12) и проверьте ошибки

**Награда не начисляется?**
- Проверьте консоль на ошибки API
- Проверьте Supabase Logs
- Убедитесь что `reward_amount` это число

---

## 📖 Полная документация

→ [REWARDS_GUIDE.md](./REWARDS_GUIDE.md)

---

**Готово! Добавляйте партнёров и монетизируйте приложение** 🚀
