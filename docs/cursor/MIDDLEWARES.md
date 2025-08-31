# Middleware GoblinHelperBot

## Порядок выполнения middleware

```javascript
// index.js - реальный порядок подключения
bot.use(
  // 1. Session Middleware (Redis) - ВСЕГДА ПЕРВЫМИ
  SESSIONS.GLOBAL_SESSION,        // Глобальные настройки
  SESSIONS.CHANNELS_SESSION,      // Данные каналов
  SESSIONS.USER_SESSION,          // Пользовательские данные (ctx.userSession)
  SESSIONS.CHAT_SESSION,          // Данные чата (ctx.chatSession)
  SESSIONS.LOTS_SESSION,          // Данные лотов
  SESSIONS.USERS_SESSION,         // Список пользователей (ctx.users)
  SESSIONS.MONTHS_SESSION,        // Данные месяцев (ctx.months)
  SESSIONS.KICKSTARTERS_SESSION,  // Данные kickstarter проектов
  SESSIONS.SETTINGS_SESSION,      // Настройки (ctx.settings)
  SESSIONS.POLLS_SESSION          // Данные опросов (ctx.polls)
);

// 2. Telegraf Session - ВСЕГДА ВТОРЫМ
bot.use(session());

// 3. Stage Middleware (Scenes) - ВСЕГДА ТРЕТЬИМ
bot.use(stage.middleware());

// 4. Feature Modules - В ПОРЯДКЕ ПРИОРИТЕТА
bot.use(require('./modules/lots'));           // Лоты (высокий приоритет)
bot.use(require('./modules/polls'));          // Опросы
bot.use(require('./modules/indexator-creator')); // Индексатор
bot.use(require('./modules/payments'));       // Платежи
bot.use(require('./modules/admin'));          // Админ функции
bot.use(require('./modules/users'));          // Пользовательские функции
bot.use(require('./modules/common'));         // Общие команды (низкий приоритет)
```

## Инварианты (обязательные правила)

1. **Session middleware ВСЕГДА первыми** - данные должны быть доступны для всех последующих middleware
2. **Telegraf session ВСЕГДА вторым** - стандартная сессия Telegraf
3. **Stage middleware ВСЕГДА третьим** - сцены должны быть доступны до обработки команд
4. **Feature modules в порядке приоритета** - от специфичных к общим
5. **Error boundary ВСЕГДА последним** - обработка ошибок после всех middleware

## Session Middleware (Redis)

### Глобальные сессии (без контекста)
```javascript
// modules/sessions.js
const globalSession = new RedisSession({
  property: 'globalSession',
  getSessionKey: () => { return "global" }
});

const channelsSession = new RedisSession({
  property: 'channelsSession', 
  getSessionKey: () => { return "channels" }
});

const users = new RedisSession({
  property: 'users',
  getSessionKey: () => { return "users" }
});

const months = new RedisSession({
  property: 'months',
  getSessionKey: () => { return "months" }
});

const kickstarters = new RedisSession({
  property: 'kickstarters',
  getSessionKey: () => { return "kickstarters" }
});

const settings = new RedisSession({
  property: 'settings',
  getSessionKey: () => { return "settings" }
});

const polls = new RedisSession({
  property: 'polls',
  getSessionKey: () => { return "polls" }
});

const lots = new RedisSession({
  property: 'lots',
  getSessionKey: () => { return "lots" }
});
```

### Контекстные сессии (с привязкой к пользователю/чату)
```javascript
const userSession = new RedisSession({
  property: 'userSession',
  getSessionKey: (ctx) => { 
    if (ctx.from) return `${ctx.from.id}-user` 
  }
});

const chatSession = new RedisSession({
  property: 'chatSession',
  getSessionKey: (ctx) => { 
    if (ctx.chat) return `${ctx.chat.id}-chat` 
  }
});
```

## Feature Modules

### 1. Lots Module (высокий приоритет)
```javascript
// modules/lots/index.js
module.exports = Composer.compose([
  require('./commands/enter'),    // /enter - вход в лот
  require('./commands/revive'),   // /revive - возрождение лота
  require('./commands/info'),     // /info - информация о лоте
  require('./commands/infom'),    // /infom - информация для модераторов
  require('./commands/upd'),      // /upd - обновление лота
  require('./commands/nf'),       // /nf - новый формат
  require('./actions/leave'),     // Покинуть лот
  require('./actions/join'),      // Присоединиться к лоту
  require('./actions/close')      // Закрыть лот
])
```

### 2. Polls Module
```javascript
// modules/polls/index.js
module.exports = Composer.compose([
  require('./commands/count'),    // /count - подсчет голосов
  require('./commands/add'),      // /add - добавить голос
  require('./commands/addByPlus'), // /addByPlus - добавить голос через Plus
])
```

### 3. Indexator Creator Module
```javascript
// modules/indexator-creator/index.js
module.exports = Composer.compose([
  require('./triggers/main'),     // Триггеры для создания индекса
])
```

### 4. Payments Module
```javascript
// modules/payments/index.js
module.exports = Composer.compose([
  require('./commands/thisis'),           // /thisis - подтверждение платежа
  require('./commands/thisis-channel'),   // /thisis-channel - подтверждение в канале
])
```

### 5. Admin Module
```javascript
// modules/admin/index.js
module.exports = Composer.compose([
  ...actions,   // Все action handlers из папки actions/
  ...commands   // Все command handlers из папки commands/
])
```

### 6. Users Module
```javascript
// modules/users/index.js
module.exports = Composer.compose([
  ...actions,   // Все action handlers из папки actions/
  ...commands   // Все command handlers из папки commands/
])
```

### 7. Common Module (низкий приоритет)
```javascript
// modules/common/index.js
module.exports = Composer.compose([
  require('./commands/id'),               // /id - показать ID
  require('./commands/roll'),             // /roll - случайное число
  require('./actions/deleteThisMessage'), // Удалить сообщение
])
```

## Авторизация

### Проверка админа
```javascript
// modules/util.js
function isAdmin(telegramUserID) {
  const isAnAdmin = telegramUserID == SETTINGS.CHATS.EPINETOV ||
    telegramUserID == SETTINGS.CHATS.ALEKS ||
    telegramUserID == SETTINGS.CHATS.ARTYOM;
  return isAnAdmin;
}

function isSuperUser(userId) {
  if (userId == SETTINGS.CHATS.EPINETOV || userId == SETTINGS.CHATS.ANN) {
    return true;
  }
  return false;
}
```

### Проверка ролей пользователя
```javascript
// В обработчиках команд
if (userInfo.roles.indexOf('rejected') > -1) {
  return; // Отклоненный пользователь
}

const adminRole = type == 'plus' ? 'adminPlus' : 'admin';
const isAppropriateAdmin = userInfo.roles.indexOf(adminRole) > -1;
```

## Логирование

### Информационные логи
```javascript
// modules/util.js
function log(ctx) {
  let message = `\x1b[34m[INFO]${colors.reset} \x1b[36m${date.getTimeForLogging()}${colors.reset} `
  
  if (typeof ctx.update.callback_query === 'undefined') {
    if (typeof ctx.message.text !== 'undefined') {
      if (ctx.message.text[0] === '/') {
        message += `@${ctx.message.from.username} (${ctx.message.from.id}) has issued command ${colors.green}'/${ctx.message.text.split('/')[1]}'${colors.reset} `
      }
    }
  } else {
    message += `@${ctx.update.callback_query.from.username} has called an action ${colors.green}'${ctx.callbackQuery.data}'${colors.reset} `
  }
  
  console.log(message);
}
```

### Логирование ошибок
```javascript
function logError(ctx, error) {
  let message = `\x1b[31m================${colors.reset}\n\x1b[31m[ERROR]${colors.reset} \x1b[36m${date.getTimeForLogging()}${colors.reset} `
  // ... детали ошибки
  message += ` \x1b[31mand got the error:${colors.reset}\n\x1b[31m${error}${colors.reset}\n\x1b[31m================${colors.reset}`
  console.log(message);
}
```

## Error Boundary

### Глобальный обработчик ошибок
```javascript
// index.js - ВСЕГДА ПОСЛЕДНИМ
bot.catch((error) => {
  console.log(error);
});
```

### Graceful shutdown
```javascript
// index.js
bot.launch()
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
```

## Rate Limiting

### Встроенные ограничения Telegraf
- Автоматическое ограничение на callback queries
- Throttling для API вызовов
- Ограничения на размер сообщений

### Кастомные ограничения
```javascript
// В обработчиках
const userCooldown = new Map();

function checkCooldown(userId, command, cooldownMs = 5000) {
  const now = Date.now();
  const lastCall = userCooldown.get(`${userId}_${command}`);
  
  if (lastCall && (now - lastCall) < cooldownMs) {
    return false;
  }
  
  userCooldown.set(`${userId}_${command}`, now);
  return true;
}
```

## i18n (Интернационализация)

### Текущее состояние
- Бот работает только на русском языке
- Все тексты хардкодены в коде
- Нет системы переводов

### Рекомендации для i18n
```javascript
// Будущая структура
const i18n = require('telegraf-i18n');
const path = require('path');

bot.use(i18n.middleware());
bot.use(i18n.load(path.join(__dirname, 'locales')));

// В обработчиках
ctx.reply(ctx.i18n.t('greeting'));
```

## Порядок важности middleware

1. **Session** - данные должны быть доступны для всех последующих middleware
2. **Telegraf Session** - стандартная сессия Telegraf
3. **Stage** - сцены должны быть доступны до обработки команд
4. **Feature Modules** - основная бизнес-логика в порядке приоритета
5. **Error Boundary** - обработка ошибок после всех middleware

## Добавление нового middleware

При добавлении нового middleware соблюдайте порядок:

1. **Session middleware** - только в начале, если нужны новые данные
2. **Feature middleware** - в соответствующем модуле или как отдельный модуль
3. **Error handling** - только в конце, если нужна специальная обработка ошибок

```javascript
// Правильный порядок добавления
bot.use(newSessionMiddleware);     // В начало, если это session
bot.use(newFeatureMiddleware);     // В соответствующее место среди feature modules
bot.use(newErrorMiddleware);       // В конец, если это error handling
``` 