# TON Connect Quick Setup Guide

## Быстрый старт

### 1. Установите зависимости

TON Connect SDK уже настроен в проекте. Убедитесь, что используете следующие пакеты:

```bash
# Эти пакеты уже импортированы в коде
@tonconnect/ui-react
```

### 2. Обновите TON Connect Manifest

Откройте `/tonconnect-manifest.json` и замените placeholder URL на реальные:

```json
{
  "url": "https://your-app-domain.com",
  "name": "Cladhunter",
  "iconUrl": "https://your-app-domain.com/icon-512x512.png",
  "termsOfUseUrl": "https://your-app-domain.com/terms",
  "privacyPolicyUrl": "https://your-app-domain.com/privacy"
}
```

**Важно:** URL должен совпадать с доменом вашего приложения!

### 3. Установите адрес мерчанта

В Supabase Dashboard добавьте environment variable для Edge Function:

```
VITE_TON_MERCHANT_ADDRESS=EQC...your-ton-wallet-address
```

Или локально в `.env`:

```bash
VITE_TON_MERCHANT_ADDRESS=EQC...your-ton-wallet-address
```

**Как получить адрес:**
1. Откройте ваш TON кошелек (Tonkeeper, MyTonWallet и т.д.)
2. Скопируйте ваш основной адрес кошелька
3. Используйте этот адрес в настройках

### 4. Проверьте интеграцию

1. Запустите приложение
2. Перейдите на экран Wallet
3. Нажмите "Connect TON Wallet"
4. Выберите кошелек и подключитесь
5. Попробуйте купить буст

## Структура файлов

```
/hooks/useTonConnect.tsx        - Хук для работы с TON Connect
/components/TonConnectButton.tsx - UI кнопка подключения
/components/WalletScreen.tsx    - Экран с интеграцией
/tonconnect-manifest.json       - Манифест приложения
/App.tsx                        - TonConnectUIProvider
```

## Как это работает

### 1. Подключение кошелька

```typescript
const { wallet, isConnected, connect } = useTonConnect();

// Подключить
await connect();

// Проверить статус
if (isConnected) {
  console.log('Connected:', wallet.address);
}
```

### 2. Отправка транзакции

```typescript
const { sendTransaction } = useTonConnect();

const result = await sendTransaction({
  to: 'EQC...merchant-address',
  amount: '300000000', // 0.3 TON в nanoTON
  payload: 'optional-comment'
});

console.log('Transaction hash:', result.boc);
```

### 3. Flow покупки буста

```
User → Click Boost Button → Check Wallet Connected
  ↓
Create Order on Server
  ↓
Open TON Wallet → User Confirms Transaction
  ↓
Transaction Sent → Server Confirms → Boost Activated
```

## Конфигурация для testnet

Для тестирования на testnet:

1. Переключите кошелек на testnet режим
2. Получите testnet TON с faucet: https://t.me/testgiver_ton_bot
3. Используйте testnet адрес мерчанта
4. Все остальное работает так же!

## Важные моменты

### ⚠️ Безопасность

- **Никогда** не храните приватные ключи в коде
- **Всегда** проверяйте транзакции на сервере (см. TODO в коде)
- Используйте HTTPS в production

### 💡 Best Practices

1. **Проверяйте подключение** перед отправкой транзакции
2. **Обрабатывайте ошибки** - пользователь может отклонить транзакцию
3. **Показывайте статус** - loading, success, error
4. **Тестируйте** на testnet перед mainnet

### 🔧 Troubleshooting

**Кошелек не подключается:**
- Проверьте что `tonconnect-manifest.json` доступен по URL
- Убедитесь что URL в манифесте совпадает с доменом
- Проверьте консоль браузера на ошибки

**Транзакция не проходит:**
- Проверьте баланс кошелька
- Убедитесь что адрес мерчанта правильный
- Проверьте что сумма в nanoTON (1 TON = 1,000,000,000 nanoTON)

**Boost не активируется:**
- Проверьте логи сервера
- Убедитесь что API endpoint `/orders/:id/confirm` работает
- В production добавьте верификацию транзакции

## Production Checklist

- [ ] Обновить `tonconnect-manifest.json` с реальными URL
- [ ] Установить `VITE_TON_MERCHANT_ADDRESS` в production
- [ ] Добавить верификацию транзакций на блокчейне (см. TON_INTEGRATION.md)
- [ ] Настроить мониторинг транзакций
- [ ] Добавить rate limiting для API
- [ ] Протестировать на mainnet с небольшими суммами
- [ ] Настроить логирование ошибок

## Дополнительные ресурсы

- [TON Connect Docs](https://docs.ton.org/develop/dapps/ton-connect/overview)
- [TON Connect React UI](https://github.com/ton-connect/sdk/tree/main/packages/ui-react)
- [TON API](https://toncenter.com/api/v2/)
- Полная документация: см. `/TON_INTEGRATION.md`

## Поддержка

Если что-то не работает:
1. Проверьте консоль браузера
2. Проверьте логи Supabase Edge Function
3. Убедитесь что все environment variables установлены
4. См. раздел Troubleshooting в `/TON_INTEGRATION.md`

---

**Ready to accept TON payments!** 🚀💎
