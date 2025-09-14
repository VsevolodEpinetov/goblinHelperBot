# Состояние и сессии GoblinHelperBot

## Хранение состояния

### Хранилища: Redis + Postgres
Сейчас бот использует гибридную модель хранения данных:

- Redis (через `telegraf-session-redis-upd`) — сцены и временные/операционные данные:
  - `globalSession`, `lots`, `polls`, `channelsSession`, а также по-пользовательские и по-чату сессии (`userSession`, `chatSession`).
- Postgres — постоянные данные домена:
  - `users`, `months`, `kickstarters`, `settings` (строковые значения).

Доступ к Postgres интегрирован через middleware-«мост», который гидрирует `ctx.users`, `ctx.months`, `ctx.kickstarters`, `ctx.settings` перед обработчиками и сбрасывает изменения обратно в БД после них. Весь остальной код продолжает работать с прежними структурами `ctx.*`.

```javascript
// modules/sessions.js
const RedisSession = require('telegraf-session-redis-upd')
```

### Типы сессий

#### 1. Глобальные сессии (одна на весь бот)
```javascript
const globalSession = new RedisSession({
  property: 'globalSession',
  getSessionKey: () => { return "global" }
});

const lots = new RedisSession({
  property: 'lots',
  getSessionKey: () => { return "lots" }
});

const polls = new RedisSession({
  property: 'polls',
  getSessionKey: () => { return "polls" }
});

const channelsSession = new RedisSession({
  property: 'channelsSession',
  getSessionKey: () => { return "channels" }
});
```

Примечание: сессии `users`, `months`, `kickstarters`, `settings` больше не регистрируются в `index.js` и заменены PG-мостом. Они могут оставаться определёнными в коде для обратной совместимости, но не используются.

#### 2. Пользовательские сессии (на пользователя)
```javascript
const userSession = new RedisSession({
  property: 'userSession',
  getSessionKey: (ctx) => { 
    if (ctx.from) return `${ctx.from.id}-user` 
  }
});
```

#### 3. Чат сессии (на чат)
```javascript
const chatSession = new RedisSession({
  property: 'chatSession',
  getSessionKey: (ctx) => { 
    if (ctx.chat) return `${ctx.chat.id}-chat` 
  }
});
```

## Пространства ключей Redis

### Глобальные ключи (без TTL)
- `global` - глобальные настройки и текущий месяц
- `lots` - лоты
- `polls` - опросы
- `channels` - каналы для индексатора

Пользователи, месяцы, кикстартеры, настройки — теперь в Postgres.

### Пользовательские ключи (без TTL)
- `{userId}-user` - сессия пользователя

### Чат ключи (без TTL)
- `{chatId}-chat` - сессия чата

### Telegraf Session (временная)
- `{userId}:{chatId}` - стандартная сессия Telegraf для сцен

## TTL (Time To Live)

### Текущее состояние
- **Redis sessions**: БЕЗ TTL (хранятся до перезапуска Redis)
- **Пользовательские данные**: постоянные (без TTL)
- **Глобальные данные**: постоянные (без TTL)
- **Telegraf session**: временная (для сцен)

### Отсутствие TTL
В коде НЕ настроен TTL для Redis сессий:
```javascript
// modules/sessions.js - НЕТ параметра ttl
const globalSession = new RedisSession({
  property: 'globalSession',
  getSessionKey: () => { return "global" }
  // ttl: отсутствует
});
```

### Рекомендации для TTL
```javascript
// Для временных данных (если понадобится)
const tempSession = new RedisSession({
  property: 'temp',
  getSessionKey: (ctx) => `${ctx.from.id}-temp`,
  ttl: 3600 // 1 час
});

// Для пользовательских сессий (если понадобится)
const userSession = new RedisSession({
  property: 'userSession',
  getSessionKey: (ctx) => { 
    if (ctx.from) return `${ctx.from.id}-user` 
  },
  ttl: 86400 * 30 // 30 дней
});
```

## Сериализация

### JSON сериализация
Все данные сериализуются в JSON:
```javascript
// Автоматически через telegraf-session-redis-upd
// Объекты JavaScript -> JSON -> Redis
// Redis -> JSON -> Объекты JavaScript
```

### Postgres
- Данные домена хранятся в нормализованных таблицах, но middleware мапит их в прежние структуры `ctx.*`.
- Основные таблицы (camelCase с кавычками):
  - `"users"(id, username, "firstName", "lastName")`
  - `"userPurchases"("userId", balance, "scrollsSpent")`
  - `"userRoles"("userId", role ENUM('admin','adminPlus','rejected'))`
  - `"userGroups"("userId", period 'YYYY_MM', type ENUM('regular','plus'))`
  - `"kickstarters"(id, name, creator, cost, "pledgeName", "pledgeCost", link)` + `"kickstarterPhotos"/"kickstarterFiles"`
  - `"userKickstarters"("userId", "kickstarterId", "acquiredAt", "acquiredBy")`
  - `"months"(period 'YYYY_MM', type ENUM('regular','plus'), "chatId", "counterJoined", "counterPaid")`
  - `"settings"(key, value TEXT)`

### Мост (bridge middleware)
- Перед обработчиками: читает из БД и гидрирует:
  - `ctx.users` → `{ list: { [userId]: { id, username, first_name, last_name, roles[], purchases{ balance, scrollsSpent, groups{regular[],plus[]}, kickstarters[] } } } }`
  - `ctx.months` → `{ list: { [year]: { [month]: { regular{ id, link, counter{joined,paid}}, plus{…} } } } }`
  - `ctx.kickstarters` → `{ list: Array< { name, creator, cost, pledgeName, pledgeCost, photos[], files[], link } > }`
  - `ctx.settings` → объект (строковые значения из `settings` при необходимости)
- После обработчиков: вычисляет дифф и upsert'ит изменения в БД (users, roles, purchases, groups, userKickstarters, months).

### Структуры данных

#### Пользователь (ctx.users.list[userId])
```javascript
{
  id: number,
  username: string,
  first_name: string,
  last_name: string,
  roles: string[], // ['admin', 'adminPlus', 'rejected']
  purchases: {
    balance: number,
    scrollsSpent: number,
    groups: {
      regular: string[], // ['2024_01', '2024_02']
      plus: string[]     // ['2024_01', '2024_02']
    },
    kickstarters: string[],
    collections: string[]
  }
}
```

#### Месяц (ctx.months.list[year][month])
```javascript
{
  regular: {
    id: string, // chat ID
    link: string, // пригласительная ссылка
    counter: {
      joined: number,
      paid: number
    }
  },
  plus: {
    id: string, // chat ID
    link: string, // пригласительная ссылка
    counter: {
      joined: number,
      paid: number
    }
  }
}
```

#### Глобальная сессия (ctx.globalSession)
```javascript
{
  current: {
    year: string, // "2024"
    month: string // "01"
  },
  studios: string[], // для опросов
  toRemove: { // временные данные для удаления сообщений
    [chatId]: {
      [key]: number[] // message IDs
    }
  }
}
```

#### Лот (ctx.lots.list[lotId])
```javascript
{
  photo: string, // file_id
  photos: string[], // массив file_id
  price: number,
  currency: string, // 'USD', 'EUR', 'RUB'
  link: string,
  author: string,
  name: string,
  whoCreated: {
    id: number,
    username: string,
    first_name: string,
    last_name: string
  },
  participants: string[], // userId[]
  lastMessage: {
    user: string, // message_id
    bot: string   // message_id
  },
  messageID: string,
  chatID: string,
  opened: boolean
}
```

#### Кикстартер (ctx.kickstarters.list[kickstarterId])
```javascript
{
  name: string,
  creator: string,
  cost: number,
  pledgeName: string,
  pledgeCost: number,
  photos: string[], // file_id[]
  files: string[],  // file_id[]
  link: string
}
```

#### Каналы (ctx.channelsSession.channels[channelId])
```javascript
{
  indexers: string[], // сообщения с 🔸
  studios: string[],  // студии
  locked: boolean,    // заблокирован ли автоматический режим
  type: string        // 'archive' | 'collection'
}
```

## Очистка кешей

### Автоматическая очистка
- **НЕТ** автоматической очистки Redis сессий
- **НЕТ** TTL для данных
- Данные хранятся до перезапуска Redis сервера

### Ручная очистка
```javascript
// Очистка временных данных в сценах
ctx.session.lot = null; // очистка данных лота
ctx.session.kickstarter = null; // очистка данных кикстартера
ctx.session.editingKickstarter = null; // очистка редактирования

// Очистка временных сообщений
ctx.globalSession.toRemove = {}; // очистка списка сообщений для удаления
```

### Команды очистки
```javascript
// indexf.js - очистка лотов
bot.command('nl', ctx => {
  ctx.globalSession.lots = [];
})

// modules/indexator-creator/triggers/main.js - сброс канала
if (messageText === 'reset') {
  localChannels.channels[channelID] = {
    indexers: [],
    studios: [],
    locked: false,
    type: 'archive'
  };
}
```

## Инварианты

### Пользователи
1. Каждый пользователь имеет уникальный `id`
2. `roles` всегда массив (пустой для обычных пользователей)
3. `purchases.balance` >= 0
4. `purchases.scrollsSpent` >= 0
5. `purchases.groups.regular` и `plus` содержат строки формата `YYYY_MM`

### Месяцы
1. Структура: `ctx.months.list[year][month][type]`
2. `type` может быть `regular` или `plus`
3. `counter.joined` >= 0
4. `counter.paid` >= 0
5. `id` - валидный chat ID

### Лоты
1. `price` >= 0
2. `currency` из списка: `USD`, `EUR`, `RUB`
3. `opened` - boolean
4. `participants` - массив userId
5. `photos` - массив file_id (1-10 элементов)

### Глобальная сессия
1. `current.year` - строка года (например, "2024")
2. `current.month` - строка месяца (например, "01")
3. `studios` - массив строк для опросов

### Кикстартеры
1. `cost` >= 0
2. `pledgeCost` >= 0
3. `photos` и `files` - массивы file_id

## Доступ к данным

### В обработчиках
```javascript
// Пользователь
const userData = ctx.users.list[ctx.from.id];

// Текущий месяц
const currentYear = ctx.globalSession.current.year;
const currentMonth = ctx.globalSession.current.month;

// Месяц пользователя
const monthData = ctx.months.list[currentYear][currentMonth];

// Лоты
const lots = ctx.lots.list;

// Кикстартеры
const kickstarters = ctx.kickstarters.list;

// Настройки
const settings = ctx.settings;
```

### Обновление данных
```javascript
// Изменение баланса
ctx.users.list[userId].purchases.balance += amount;

// Добавление месяца
ctx.users.list[userId].purchases.groups.regular.push(`${year}_${month}`);

// Обновление счетчика
ctx.months.list[year][month][type].counter.joined += 1;

// Добавление лота
ctx.globalSession.lots.push(lotData);

// Добавление кикстартера
ctx.kickstarters.list.push(kickstarterData);
```

С PG-мостом эти изменения будут автоматически сохранены в Postgres после завершения обработчика.

## Прямой доступ к Redis

### sessionInstance
```javascript
// modules/indexator-creator/triggers/main.js
const sessionInstance = new RedisSession();

// Прямое чтение
await sessionInstance.getSession('channelsSession').then(session => { 
  localChannels = session; 
});

// Прямая запись
sessionInstance.saveSession('channelsSession', localChannels);
```

## Миграции

### Команда миграции
```javascript
// modules/admin/commands/migrate.js
module.exports = Composer.command('migrate', async (ctx) => {
  // Миграция данных между версиями
});
```

### Рекомендации
1. Всегда делайте бэкап перед миграцией
2. Тестируйте миграции на копии данных
3. Версионируйте структуры данных
4. Логируйте все изменения

### Импорт из Redis в Postgres
- Разовый импорт последних сессий реализован скриптом: `scripts/import_redis_to_pg.js`
- Ожидает бэкапы в `backups/<timestamp>/{users,months,kickstarters,settings}.json`
- Порядок импорта: kickstarters → users (+roles, groups, purchases, userKickstarters) → months → settings.

## Расхождения в коде

### Найденные проблемы:

1. **Отсутствие TTL** - все Redis сессии хранятся без TTL, что может привести к накоплению данных
2. **Прямой доступ к Redis** - в `modules/indexator-creator/triggers/main.js` используется `sessionInstance` вместо middleware (оставлено, т. к. это отдельная подсистема каналов)
3. **Неиспользуемый sessionInstance** - в `index.js` создается `sessionInstance`, но для доменных данных теперь применяется PG-мост
4. **Отсутствие очистки** - нет автоматической очистки устаревших данных в Redis (актуально для временных сессий)
5. **Хардкод ключей** - ключи Redis хардкодены в коде без централизованного управления

### Рекомендации по исправлению:

1. Добавить TTL для временных данных
2. Убрать прямой доступ к Redis там, где это возможно, или изолировать адаптером
3. Удалить/перенести неиспользуемый `sessionInstance`
4. Добавить периодическую очистку устаревших данных
5. Создать константы для ключей Redis