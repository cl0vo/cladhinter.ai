# TON Connect Integration Guide

## Обзор

Cladhunter теперь полностью интегрирован с TON blockchain через TON Connect. Пользователи могут подключать свои TON кошельки и совершать покупки бустов за криптовалюту TON.

## Возможности

### ✅ Реализовано

1. **Подключение кошелька**
   - Поддержка всех популярных TON кошельков (Tonkeeper, MyTonWallet, OpenMask и др.)
   - Автоматическая синхронизация статуса подключения
   - Отображение адреса подключенного кошелька

2. **Отправка транзакций**
   - Автоматическая отправка TON при покупке бустов
   - Конвертация суммы в nanoTON
   - Добавление payload для идентификации платежа
   - Обработка ошибок транзакций

3. **Обработка платежей**
   - Создание заказа на сервере
   - Отправка транзакции через TON Connect
   - Автоматическое подтверждение при успехе
   - Fallback на ручное подтверждение при ошибке

## Архитектура

### Frontend компоненты

1. **`/hooks/useTonConnect.tsx`**
   - Управление подключением кошелька
   - Инициализация TON Connect UI
   - Отправка транзакций
   - Отслеживание статуса кошелька

2. **`/components/TonConnectButton.tsx`**
   - UI компонент для подключения/отключения кошелька
   - Отображение адреса кошелька
   - Кнопки Connect/Disconnect

3. **`/components/WalletScreen.tsx`**
   - Интеграция TON кошелька в UI
   - Логика покупки бустов через TON
   - Обработка статусов транзакций

### Backend endpoints

1. **POST `/orders/create`**
   - Создает заказ на покупку буста
   - Возвращает адрес мерчанта и детали платежа
   - Генерирует уникальный payload

2. **POST `/orders/:orderId/confirm`**
   - Подтверждает оплату заказа
   - Принимает tx_hash транзакции
   - Активирует буст для пользователя
   - TODO: Добавить верификацию транзакции на блокчейне

## Настройка

### 1. TON Connect Manifest

Файл `/tonconnect-manifest.json` содержит метаданные приложения для TON Connect:

```json
{
  "url": "https://cladhunter.app",
  "name": "Cladhunter",
  "iconUrl": "https://cladhunter.app/icon-512x512.png",
  "termsOfUseUrl": "https://cladhunter.app/terms",
  "privacyPolicyUrl": "https://cladhunter.app/privacy"
}
```

**ВАЖНО:** Обновите эти URL на реальные после деплоя!

### 2. Адрес мерчанта

Установите переменную окружения `VITE_TON_MERCHANT_ADDRESS` с вашим TON адресом для приема платежей:

```bash
export VITE_TON_MERCHANT_ADDRESS="EQC...your-ton-address"
```

Или добавьте в Supabase Edge Function environment variables.

### 3. Проверка транзакций (Production)

В production необходимо добавить верификацию транзакций на блокчейне:

```typescript
// В /supabase/functions/server/index.tsx
// Замените TODO секцию на реальную верификацию:

import { TonClient, Address } from 'npm:ton';

async function verifyTonTransaction(
  txHash: string,
  expectedAmount: number,
  merchantAddress: string
): Promise<boolean> {
  const client = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: Deno.env.get('TON_API_KEY')
  });
  
  // Получить транзакцию по хэшу
  const tx = await client.getTransaction(txHash);
  
  // Проверить получателя
  if (tx.to !== merchantAddress) return false;
  
  // Проверить сумму (в nanoTON)
  const amountInNano = expectedAmount * 1_000_000_000;
  if (tx.value < amountInNano) return false;
  
  return true;
}
```

## Flow покупки буста

1. Пользователь нажимает кнопку "Connect TON Wallet"
2. Открывается модальное окно TON Connect
3. Пользователь выбирает кошелек и подключается
4. Пользователь нажимает кнопку цены буста (например, "0.3 TON")
5. Создается заказ на сервере
6. Автоматически открывается кошелек для подтверждения транзакции
7. Пользователь подтверждает отправку TON
8. После успешной отправки заказ автоматически подтверждается
9. Буст активируется и баланс обновляется

### Fallback для ручного платежа

Если автоматическая транзакция не удалась:
1. Заказ сохраняется как "pending"
2. Показывается карточка с адресом и суммой
3. Пользователь может отправить вручную
4. Кнопка "I HAVE SENT THE PAYMENT" подтверждает заказ

## Структура данных

### Order

```typescript
interface Order {
  id: string;              // Уникальный ID заказа
  user_id: string;         // ID пользователя
  boost_level: number;     // Уровень буста (1-4)
  ton_amount: number;      // Сумма в TON
  status: 'pending' | 'paid' | 'failed';
  payload: string;         // Уникальный payload для идентификации
  tx_hash: string | null;  // Хэш транзакции TON
  created_at: string;      // Время создания
}
```

### Wallet State

```typescript
interface TonWallet {
  address: string;    // Адрес кошелька
  chain: string;      // Сеть (mainnet/testnet)
  publicKey: string;  // Публичный ключ
}
```

## Безопасность

### ✅ Реализовано

- Проверка авторизации пользователя
- Уникальные payload для каждого заказа
- Проверка владельца заказа
- Защита от повторного подтверждения
- CORS настройки

### 🔄 TODO для Production

- [ ] Верификация транзакций на блокчейне
- [ ] Webhooks для автоматического подтверждения
- [ ] Rate limiting для API endpoints
- [ ] Логирование всех транзакций
- [ ] Мониторинг failed транзакций
- [ ] Автоматический refund при ошибках

## Тестирование

### Development

В режиме разработки можно использовать TON testnet:
1. Переключите кошелек на testnet
2. Получите testnet TON с faucet
3. Используйте testnet адрес мерчанта

### Production Checklist

- [ ] Обновить `tonconnect-manifest.json` с реальными URL
- [ ] Установить `VITE_TON_MERCHANT_ADDRESS`
- [ ] Добавить верификацию транзакций
- [ ] Настроить мониторинг
- [ ] Протестировать на mainnet с малыми суммами

## API Reference

### Frontend Hook

```typescript
const {
  wallet,           // Информация о подключенном кошельке
  isConnected,      // Статус подключения
  isConnecting,     // Процесс подключения
  connect,          // Функция подключения
  disconnect,       // Функция отключения
  sendTransaction   // Отправка транзакции
} = useTonConnect();
```

### Отправка транзакции

```typescript
const result = await sendTransaction({
  to: merchantAddress,           // Адрес получателя
  amount: '300000000',           // Сумма в nanoTON
  payload: 'unique_order_id'     // Опциональный payload
});
```

## Troubleshooting

### Ошибка: "Wallet not connected"
- Убедитесь что пользователь подключил кошелек
- Проверьте что `isConnected === true`

### Ошибка: "Transaction failed"
- Проверьте баланс кошелька
- Убедитесь что адрес мерчанта корректный
- Проверьте что сумма в nanoTON правильная

### Заказ не подтверждается
- Проверьте логи сервера
- Убедитесь что tx_hash передается правильно
- В production добавьте верификацию транзакции

## Поддержка

Для вопросов и багов:
- GitHub Issues: [ваш репозиторий]
- Telegram: @cladhunter_support
- Email: support@cladhunter.app

## Лицензия

См. LICENSE файл в корне проекта.
