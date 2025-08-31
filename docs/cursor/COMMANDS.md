# Команды GoblinHelperBot

## Таблица команд

| Команда | Файл | Краткое описание | Доступность |
|---------|------|------------------|-------------|
| `/start` | `modules/users/commands/start.js` | Главное меню пользователя, регистрация | Все пользователи |
| `/id` | `modules/common/commands/id.js` | Показать Telegram ID пользователя | Все пользователи |
| `/roll` | `modules/common/commands/roll.js` | Случайное число от 1 до указанного | Все пользователи |
| `/ex` | `index.js` | Выполнить код (eval) | Только EPINETOV |
| `/migrate` | `modules/admin/commands/migrate.js` | Миграция данных | Только EPINETOV |
| `/remember` | `modules/admin/commands/remember.js` | Запомнить данные | Админы |
| `/rememberchat` | `modules/admin/commands/rememberchat.js` | Запомнить чат | Админы |
| `/add` | `modules/polls/commands/add.js` | Добавить студию в опрос | Админы |
| `/addByPlus` | `modules/polls/commands/addByPlus.js` | Добавить опрос через Plus (реакция '+') | Plus пользователи |
| `/count` | `modules/polls/commands/count.js` | Подсчет голосов в опросе | Все пользователи |
| `/info` | `modules/lots/commands/info.js` | Информация о лоте (по reply) | Только EPINETOV |
| `/infom` | `modules/lots/commands/infom.js` | Информация о лоте (модерация) | Модераторы |
| `/revive` | `modules/lots/commands/revive.js` | Возродить закрытый лот | Модераторы |
| `/upd` | `modules/lots/commands/upd.js` | Обновить информацию о лоте | Модераторы |
| `/nf` | `modules/lots/commands/nf.js` | Новый формат лота | Модераторы |
| `/enter` | `modules/lots/commands/enter.js` | Войти в лот (текст "гоблин, хочу создать лот") | Все пользователи |
| `/thisis` | `modules/payments/commands/thisis.js` | Записать чат как группу месяца | Только EPINETOV |
| `/thisis-channel` | `modules/payments/commands/thisis-channel.js` | Записать канал как группу месяца | Автоматически |
| `/who` | `modules/scans/commands/who.js` | Сканирование участников (реакция 👍) | Только EPINETOV |

## Алиасы и паттерны

### Callback Actions
- `userMonths` - меню подписок пользователя
- `userKickstarters` - меню кикстартеров пользователя
- `adminMenu` - главное меню админа
- `adminParticipants` - список участников
- `showUserMonths_{userId}` - показать месяцы пользователя
- `changeBalance_{userId}` - изменить баланс пользователя
- `changeUserRoles_{userId}` - изменить роли пользователя

### Текстовые паттерны (hears)
- `я оплатил(!)` - старый формат подтверждения платежа (`index.js`)
- `^[яЯ]\s*оплатил(!)*$` - regex для подтверждения платежа
- `^/roll\s*[0-9]+$` - команда roll с числом (`modules/common/commands/roll.js`)
- `^[гГ]облин[,]? хочу создать лот[.!]?$` - создание лота (`modules/lots/commands/enter.js`)
- `+` - добавление опроса через Plus (`modules/polls/commands/addByPlus.js`)

### Реакции (reaction)
- `👍` - сканирование участников чата (`modules/scans/commands/who.js`)

### События (on)
- `channel_post` - обработка постов в каналах (`modules/payments/commands/thisis-channel.js`, `modules/indexator-creator/triggers/main.js`)
- `chat_join_request` - обработка запросов на вступление в группу (`index.js`)

## Сцены (Scenes)

### Регистрация сцен в index.js
```javascript
const lotsScenes = util.getAllFilesFromFolder('./modules/lots/scenes').map(file => require(file));
const adminScenes = util.getAllFilesFromFolder('./modules/admin/scenes').map(file => require(file));
const usersScenes = util.getAllFilesFromFolder('./modules/users/scenes').map(file => require(file));

const stage = new Scenes.Stage([...lotsScenes, ...adminScenes, ...usersScenes]);
```

### Сцены лотов (`modules/lots/scenes/`)
- `author.js` - ввод автора лота
- `link.js` - ввод ссылки на лот
- `name.js` - ввод названия лота
- `photo.js` - загрузка фото лота
- `price.js` - ввод цены и валюты лота

### Сцены админа (`modules/admin/scenes/`)
- `addLink.js` - добавление ссылки приглашения
- `addLinkPlus.js` - добавление Plus ссылки
- `addMonth.js` - добавление месяца
- `addUserMonth.js` - добавление месяца пользователю
- `addYear.js` - добавление года
- `removeMonth.js` - удаление месяца
- `removeUserMonth.js` - удаление месяца у пользователя
- `removeYear.js` - удаление года
- `users/changeBalance.js` - изменение баланса пользователя
- `users/changeRoles.js` - изменение ролей пользователя
- `users/changeTicketsSpent.js` - изменение потраченных билетиков
- `users/search.js` - поиск пользователя
- `polls/addCore.js` - добавление Core опроса
- `polls/addStudios.js` - добавление Studios опроса
- `kickstarters/` - управление кикстартерами (name, cost, creator, link, photos, files, tags, pledgeName, pledgeCost, replaceFiles)

### Сцены пользователей (`modules/users/scenes/`)
- `initiatePayment.js` - инициация платежа

## Источники текстов

### BotFather команды
```javascript
// Автоматически генерируются из:
// - modules/*/commands/*.js
// - modules/*/actions/*.js (callback actions)
```

### /help текст
```javascript
// Формируется из:
// - Описаний в командах
// - Ролей пользователя
// - Доступных функций
```

## Роли и доступ

### Роли пользователей
- `admin` - администратор обычных групп
- `adminPlus` - администратор Plus групп
- `rejected` - отклоненный пользователь
- `regular` - обычный пользователь

### Специальные ID
- `EPINETOV` (91430770) - главный админ
- `ALEKS` (628694430) - админ
- `ANN` (101922344) - суперпользователь
- `ARTYOM` (1129968341) - админ

## Структура команды

```javascript
// modules/{feature}/commands/{command}.js
const { Composer } = require('telegraf');

module.exports = Composer.command('command', async (ctx) => {
  // Проверка прав доступа
  if (!isAdmin(ctx.from.id)) return;
  
  // Бизнес-логика
  // ...
  
  // Ответ
  ctx.reply('Response');
});
```

## Структура action

```javascript
// modules/{feature}/actions/{action}.js
const { Composer } = require('telegraf');

module.exports = Composer.action('actionName', async (ctx) => {
  // Обработка callback
  // ...
  
  // Ответ
  ctx.answerCbQuery('Done');
  ctx.editMessageText('Updated');
});
``` 