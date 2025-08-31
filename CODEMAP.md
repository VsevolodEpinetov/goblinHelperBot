# Карта кода GoblinHelperBot

## 🚀 Входные точки

### Главная точка входа
- **`index.js`** - инициализация бота, middleware, запуск
- **`indexf.js`** - альтернативная точка входа (тестирование)

### Конфигурация
- **`settings.json`** - настройки, константы, ID чатов
- **`studios.json`** - данные о студиях
- **`package.json`** - зависимости и скрипты

## 📁 Официальные API директории

### Core модули
```
modules/
├── util.js              # Утилиты и хелперы
├── sessions.js          # Redis сессии
├── date.js              # Работа с датами
└── colors.js            # Цвета для консоли
```

### Feature модули
```
modules/
├── admin/               # Административные функции
│   ├── index.js         # Composer.compose
│   ├── actions/         # Callback handlers
│   ├── commands/        # Command handlers
│   └── scenes/          # Multi-step flows
├── users/               # Пользовательские функции
│   ├── index.js         # Composer.compose
│   ├── actions/         # Callback handlers
│   ├── commands/        # Command handlers
│   └── scenes/          # Multi-step flows
├── lots/                # Управление лотами
│   ├── index.js         # Composer.compose
│   ├── actions/         # Callback handlers
│   ├── commands/        # Command handlers
│   ├── scenes/          # Multi-step flows
│   └── utils.js         # Утилиты лотов
├── polls/               # Опросы
│   ├── index.js         # Composer.compose
│   └── commands/        # Command handlers
├── payments/            # Платежи
│   ├── index.js         # Composer.compose
│   └── commands/        # Command handlers
├── scans/               # Сканирование
│   ├── index.js         # Composer.compose
│   └── commands/        # Command handlers
├── common/              # Общие функции
│   ├── index.js         # Composer.compose
│   ├── actions/         # Callback handlers
│   └── commands/        # Command handlers
└── indexator-creator/   # Создание индексаторов
    ├── index.js         # Composer.compose
    └── triggers/        # Триггеры
```

## 🔧 API функции

### Утилиты (`modules/util.js`)
```javascript
// Пользователи
getUserMessage(ctx, userData)      // Сообщение пользователя
getUserButtons(ctx, userData)      // Кнопки пользователя
getUserDescription(ctx, userId)    // Описание для админа
getUserTickets(ctx, userId)        // Количество билетиков

// Проверки
isAdmin(telegramUserID)            // Проверка админа
isSuperUser(userId)                // Проверка суперпользователя

// Утилиты
getAllFilesFromFolder(dir)         // Автоимпорт файлов
splitMenu(menu, rowSize)           // Разбивка меню
hideMenu(ctx)                      // Скрытие меню
sleep(ms)                          // Задержка

// Логирование
log(ctx)                           // Информационные логи
logError(ctx, error)               // Логи ошибок

// Парсинг
getCommandParameter(ctx)           // Параметр команды
getRandomInt(min, max)             // Случайное число
```

### Сессии (`modules/sessions.js`)
```javascript
// Глобальные сессии
GLOBAL_SESSION                     // Глобальные настройки
USERS_SESSION                      // Пользователи
MONTHS_SESSION                     // Месяцы
KICKSTARTERS_SESSION               // Кикстартеры
LOTS_SESSION                       // Лоты
POLLS_SESSION                      // Опросы
SETTINGS_SESSION                   // Настройки
CHANNELS_SESSION                   // Каналы

// Пользовательские сессии
USER_SESSION                       // Сессия пользователя
CHAT_SESSION                       // Сессия чата
```

### Дата (`modules/date.js`)
```javascript
getTimeForLogging()                // Время для логов
```

## 📊 Структуры данных

### Пользователь (`ctx.users.list[userId]`)
```javascript
{
  id: number,
  username: string,
  first_name: string,
  last_name: string,
  roles: string[],
  purchases: {
    balance: number,
    ticketsSpent: number,
    groups: {
      regular: string[],
      plus: string[]
    },
    kickstarters: string[],
    collections: string[]
  }
}
```

### Месяц (`ctx.months.list[year][month]`)
```javascript
{
  regular: {
    id: string,
    counter: { joined: number }
  },
  plus: {
    id: string,
    counter: { joined: number }
  }
}
```

### Глобальная сессия (`ctx.globalSession`)
```javascript
{
  current: {
    year: string,
    month: string
  }
}
```

### Лот (`ctx.lots.list[lotId]`)
```javascript
{
  photo: string,
  price: number,
  currency: string,
  link: string,
  author: string,
  name: string,
  whoCreated: string,
  participants: string[],
  lastMessage: { user: string, bot: string },
  messageID: string,
  chatID: string,
  opened: boolean
}
```

## 🎯 Паттерны использования

### Создание команды
```javascript
// modules/feature/commands/command.js
const { Composer } = require('telegraf');
const { isAdmin, log } = require('../../util');

module.exports = Composer.command('command', async (ctx) => {
  log(ctx);
  if (!isAdmin(ctx.from.id)) return;
  // Логика
  ctx.reply('Результат');
});
```

### Создание action
```javascript
// modules/feature/actions/action.js
const { Composer } = require('telegraf');

module.exports = Composer.action('actionName', async (ctx) => {
  // Логика
  ctx.answerCbQuery('Готово');
  ctx.editMessageText('Обновлено');
});
```

### Создание модуля
```javascript
// modules/feature/index.js
const { Composer } = require('telegraf');
const { getAllFilesFromFolder } = require('../util');
const path = require('path');

const actions = getAllFilesFromFolder(path.join(__dirname, './actions'))
  .map(file => require(file));

const commands = getAllFilesFromFolder(path.join(__dirname, './commands'))
  .map(file => require(file));

module.exports = Composer.compose([
  ...actions,
  ...commands
]);
```

## 🔒 Константы и настройки

### ID пользователей (`settings.json`)
```javascript
CHATS: {
  EPINETOV: "91430770",    // Главный админ
  ALEKS: "628694430",      // Админ
  ANN: "101922344",        // Суперпользователь
  ARTYOM: "1129968341",    // Админ
  LOGS: "-1002492970591"   // Чат логов
}
```

### Валюты (`settings.json`)
```javascript
CURRENCIES: {
  USD: { EXCHANGE_RATE: 110, SYMBOL: "$", NAME: "доллары" },
  EUR: { EXCHANGE_RATE: 120, SYMBOL: "€", NAME: "евро" },
  RUB: { EXCHANGE_RATE: 1, SYMBOL: "₽", NAME: "рубли" }
}
```

## 📚 Документация

### Основная документация
- **`docs/cursor/ARCHITECTURE.md`** - архитектура и слои
- **`docs/cursor/COMMANDS.md`** - команды и их описания
- **`docs/cursor/MIDDLEWARES.md`** - middleware и их порядок
- **`docs/cursor/STATE.md`** - состояние и сессии
- **`docs/cursor/ERRORS.md`** - политика ошибок
- **`docs/cursor/GLOSSARY.md`** - доменные термины
- **`docs/cursor/GUARDRAILS.md`** - правила для ИИ

### Дополнительные файлы
- **`CODEMAP.md`** - эта карта кода
- **`repo-tree.txt`** - дерево файлов проекта
