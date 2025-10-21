# Ad System Quick Start Guide

## 🚀 Быстрый старт за 2 минуты

### Шаг 1: Подготовьте креативы

Найдите или создайте рекламные материалы:
- **Видео**: MP4, 9:16 (вертикальное), 15-30 сек
- **Изображения**: JPG/PNG, 9:16, 1080x1920px

### Шаг 2: Загрузите на CDN

Разместите файлы на любом CDN и получите публичные URLs:
- Cloudinary
- AWS S3
- Google Cloud Storage
- Или любой другой

### Шаг 3: Добавьте в конфиг

Откройте `/config/ads.ts` и добавьте в массив `adCreatives`:

```typescript
{
  id: 'my_partner',
  type: 'video', // или 'image'
  url: 'https://your-cdn.com/ad-video.mp4',
  partnerUrl: 'https://partner-website.com',
  partnerName: 'Partner Name',
  duration: 20, // для видео
}
```

### Готово! ✅

Теперь при нажатии кнопки "START MINING" будет показываться случайная реклама из вашего конфига.

---

## 📋 Полный пример конфигурации

```typescript
// /config/ads.ts

export const adCreatives: AdCreative[] = [
  // Пример 1: Видео реклама
  {
    id: 'gaming_app',
    type: 'video',
    url: 'https://cdn.example.com/gaming-ad.mp4',
    partnerUrl: 'https://gaming-app.com/download?ref=cladhunter',
    partnerName: 'Super Game',
    duration: 15,
  },
  
  // Пример 2: Статичный баннер
  {
    id: 'crypto_exchange',
    type: 'image',
    url: 'https://cdn.example.com/exchange-banner.jpg',
    partnerUrl: 'https://crypto.com/signup?utm_source=cladhunter',
    partnerName: 'Crypto Exchange',
  },
  
  // Пример 3: Ещё одно видео
  {
    id: 'nft_marketplace',
    type: 'video',
    url: 'https://cdn.example.com/nft-promo.mp4',
    partnerUrl: 'https://nft-market.io',
    partnerName: 'NFT Market',
    duration: 30,
  },
];
```

---

## ⚙️ Настройки (опционально)

В том же файле `/config/ads.ts` можете изменить:

```typescript
export const adConfig = {
  skipDelay: 6,  // Секунд до кнопки Skip (рекомендуется 5-10)
  skipButtonRandomPosition: true,  // Рандомная позиция Skip
  trackViews: true,  // Логировать просмотры на сервере
  minViewDuration: 3,  // Минимум секунд для зачёта просмотра
};
```

---

## 💰 Монетизация

Добавьте UTM-метки в `partnerUrl` для трекинга:

```typescript
partnerUrl: 'https://partner.com?utm_source=cladhunter&utm_medium=app&utm_campaign=mining_ads'
```

Используйте свою партнёрскую ссылку с реферальным кодом для получения комиссии.

---

## 📊 Как это работает

1. Пользователь нажимает **"START MINING"**
2. Показывается полноэкранная реклама
3. Через 6 секунд появляется кнопка **"CLAIM REWARD"** снизу
4. При клике на **CLAIM**:
   - Открывается сайт партнёра в новой вкладке
   - Начинается майнинг
   - Начисляется награда **10 🆑** (или больше с бустами)
5. Майнинг завершается
6. Монеты зачислены на баланс

---

## 🎯 Рекомендации

### Для лучшего CTR:

✅ **Яркие цвета** - привлекают внимание  
✅ **Чёткий CTA** - "Скачать", "Попробовать", "Купить"  
✅ **Первые 3 секунды** - самое важное в видео  
✅ **Оптимизация** - сжимайте файлы для быстрой загрузки  
✅ **A/B тестинг** - добавляйте разные варианты  

❌ **Избегайте**:
- Слишком длинных видео (>30 сек)
- Большого количества текста на изображениях
- Неоптимизированных файлов (>10MB)

---

## 🔍 Отладка

### Проверить работу:

1. Откройте приложение в браузере
2. Перейдите на экран Mining
3. Нажмите "START MINING"
4. Должна открыться полноэкранная реклама

### Если не работает:

- Проверьте консоль браузера (F12) на ошибки
- Убедитесь что URLs креативов доступны (откройте в новой вкладке)
- Проверьте CORS настройки вашего CDN
- Убедитесь что формат файлов поддерживается (MP4 для видео, JPG/PNG для картинок)

---

## 📚 Дополнительная информация

Читайте полную документацию: **[AD_SYSTEM.md](./AD_SYSTEM.md)**

---

**Нужна помощь?** Проверьте файл `/components/AdModal.tsx` для кастомизации UI рекламы.
