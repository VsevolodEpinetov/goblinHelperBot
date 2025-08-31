# Архитектура GoblinHelperBot

## Слои приложения

### 1. Transport Layer (Telegraf)
- **Файл**: `index.js`
- **Ответственность**: Инициализация бота, подключение middleware, запуск
- **Компоненты**:
  - `Telegraf` instance
  - Session middleware (Redis)
  - Stage middleware (Scenes)
  - Error handling

### 2. Features Layer
- **Структура**: `modules/{feature}/`
- **Паттерн**: `registerXxx(bot)` через `Composer.compose()`
- **Модули**:
  - `admin/` - административные функции
  - `users/` - пользовательские функции  
  - `lots/` - управление лотами
  - `polls/` - опросы
  - `payments/` - платежи
  - `scans/` - сканирование
  - `common/` - общие функции

### 3. Services Layer
- **Файлы**: `modules/util.js`, `modules/sessions.js`, `modules/date.js`
- **Ответственность**: Бизнес-логика, утилиты, сессии
- **Ключевые сервисы**:
  - Session management (Redis)
  - User management
  - Payment processing
  - Logging utilities

### 4. Adapters Layer
- **Файлы**: `modules/sessions.js`
- **Ответственность**: Адаптация внешних сервисов
- **Адаптеры**:
  - Redis session adapter
  - Telegram API adapter
  - Payment gateway adapter

### 5. Contracts Layer
- **Файлы**: `settings.json`, `studios.json`
- **Ответственность**: Конфигурация, константы, схемы данных
- **Контракты**:
  - Chat IDs и настройки
  - Валюты и курсы
  - Структуры данных

## Поток обработки обновлений

```
1. Telegram Update
   ↓
2. Session Middleware (Redis)
   - globalSession, userSession, chatSession
   - lots, months, users, kickstarters, polls
   ↓
3. Stage Middleware (Scenes)
   - lotsScenes, adminScenes, usersScenes
   ↓
4. Feature Modules
   - Composer.compose([actions, commands])
   ↓
5. Action/Command Handler
   - Business logic
   - Database operations
   ↓
6. Response
   - Message/Keyboard/Photo
```

## Паттерн registerXxx(bot)

Каждый модуль следует единому паттерну:

```javascript
// modules/{feature}/index.js
const { Composer } = require('telegraf');
const { getAllFilesFromFolder } = require('../util');

const actions = getAllFilesFromFolder('./actions').map(file => require(file));
const commands = getAllFilesFromFolder('./commands').map(file => require(file));

module.exports = Composer.compose([
  ...actions,
  ...commands
]);

// Регистрация в index.js
bot.use(require('./modules/{feature}'));
```

## Структура модуля

```
modules/{feature}/
├── index.js          # Composer.compose
├── actions/          # Callback handlers
│   ├── action1.js
│   └── action2.js
├── commands/         # Command handlers
│   ├── command1.js
│   └── command2.js
└── scenes/           # Multi-step flows
    ├── scene1.js
    └── scene2.js
```

## Ключевые принципы

1. **Модульность**: Каждый feature - отдельный модуль
2. **Composition**: Использование `Composer.compose()`
3. **Auto-discovery**: Автоматический импорт файлов через `getAllFilesFromFolder()`
4. **Session-first**: Все данные через Redis sessions
5. **Scene-based**: Сложные flows через Telegraf Scenes 