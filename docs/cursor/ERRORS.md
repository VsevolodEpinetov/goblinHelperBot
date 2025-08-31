# Политика ошибок GoblinHelperBot

## 📋 Краткое резюме анализа

### ✅ Что работает хорошо
- Есть функция `logError` с детальным логированием контекста
- Есть глобальный обработчик ошибок `bot.catch()`
- Есть graceful shutdown
- В большинстве мест есть try/catch блоки

### ❌ Основные проблемы
1. **Функция `logError` не используется** - везде только `console.log/error`
2. **Непоследовательная обработка** - в одних местах показываем пользователю ошибки, в других нет
3. **Отсутствие централизованного подхода** - каждый модуль обрабатывает ошибки по-своему
4. **Множественные try/catch** в indexator-creator без fallback

### 🔧 Что исправлено
- ✅ Добавлена функция `handleUserError` в `modules/util.js`
- ✅ Исправлен пример в `modules/lots/actions/close.js`
- ✅ Создан план миграции

### 📊 Статистика по коду
- **Try/catch блоков**: ~30 файлов
- **Console.log ошибок**: ~15 мест
- **Пользовательских сообщений об ошибках**: ~10 мест
- **Файлов без обработки ошибок**: большинство сцен

### 🎯 Приоритеты исправления
1. **Высокий**: Критические модули (lots, admin, users actions)
2. **Средний**: Сцены (scenes)
3. **Низкий**: Специальные модули (indexator-creator, polls)

---

## Общий обработчик ошибок

### Глобальный catch
```javascript
// index.js и indexf.js
bot.catch((error) => {
  console.log(error);
});
```

### Graceful shutdown
```javascript
// index.js и indexf.js
bot.launch()
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
```

## Логирование ошибок

### Функция logError
```javascript
// modules/util.js
function logError (ctx, error) {
  let message = `\x1b[31m================${colors.reset}\n\x1b[31m[ERROR]${colors.reset} \x1b[36m${date.getTimeForLogging()}${colors.reset} `
  
  if (!ctx.update.callback_query) {
    if (ctx.message.text) {
      if (ctx.message.text[0] === '/') {
        message += `@${ctx.message.from.username} \x1b[31mhas issued command${colors.reset} ${colors.green}'/${ctx.message.text.split('/')[1]}'${colors.reset} `
        if (ctx.message.chat.type == 'private') {
          message += `\x1b[31min private chat${colors.reset}`
        } else {
          message += `\x1b[31min chat named${colors.reset} '${ctx.message.chat.title}' ${colors.white}(id ${ctx.message.chat.id})${colors.reset}`
        }
      }
    }
  } else {
    message += `@${ctx.update.callback_query.from.username} \x1b[31mhas called an action${colors.reset} ${colors.green}'${ctx.callbackQuery.data}'${colors.reset} `
    if (ctx.update.callback_query.message.chat.type == 'private') {
      message += `\x1b[31min private chat${colors.reset}`
    } else {
      message += `\x1b[31min chat named${colors.reset} '${ctx.update.callback_query.message.chat.title}' ${colors.white}(id ${ctx.update.callback_query.message.chat.id})${colors.reset}`
    }
  }
  
  message += ` \x1b[31mand got the error:${colors.reset}\n\x1b[31m${error}${colors.reset}\n\x1b[31m================${colors.reset}`
  console.log(message);
}
```

**ПРОБЛЕМА**: Функция `logError` определена и экспортируется, но НЕ используется в коде!

## Текущие паттерны обработки ошибок

### 1. Try-Catch в действиях (actions)
```javascript
// modules/lots/actions/close.js
module.exports = Composer.action(/^action-close-lot-[0-9]+$/g, async (ctx) => {
  try {
    // Бизнес-логика
    const lotID = parseInt(ctx.callbackQuery.data.split('action-close-lot-')[1]);
    // ... логика закрытия лота
    await ctx.answerCbQuery('Лот успешно закрыт!');
  } catch (error) {
    console.error('Failed to close lot:', error);
    await ctx.reply('Ошибка при закрытии лота.');
  }
});
```

### 2. Try-Catch в сценах (scenes)
```javascript
// modules/lots/scenes/price.js
lotScenePriceStage.on('text', async (ctx) => {
  try {
    const price = parseFloat(ctx.message.text);
    if (isNaN(price) || price <= 0) {
      return await lotsUtils.updateLotCreationMessage(ctx, 
        `⚠️ <b>Ожидаю от тебя число! Не могу распознать, что ты прислал</b> ⚠️\n\n...`,
        // ... меню
      );
    }
    // ... логика
  } catch (e) {
    console.error('Failed to handle text message:', e);
    // НЕТ сообщения пользователю!
  }
});
```

### 3. Try-Catch для Telegram API
```javascript
// modules/admin/actions/users/changeBalance.js
try {
  await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
} catch (e) {
  await ctx.replyWithHTML(`Из-за ограничений телеграма тебе нужно использовать /start ещё раз. Старое сообщение останется, можешь его удалить вручную, если мешает.`)
  return;
}
```

### 4. Catch для Telegram API с fallback
```javascript
// index.js
const replyToTheMessage = (ctx, message, replyToID) => {
  ctx.replyWithHTML(message, {
    reply_to_message_id: replyToID
  }).catch((error) => {
    console.log("Error! Couldn't reply to a message, just sending a message. Reason:")
    console.log(error)
    ctx.replyWithHTML(message) // fallback без reply
  })
}
```

### 5. Множественные try-catch в indexator-creator
```javascript
// modules/indexator-creator/triggers/main.js
try {
  ctx.telegram.editMessageCaption(channelID, ctx.channelPost.message_id, undefined, newCaption, {
    parse_mode: "HTML"
  }).catch(e => {
    console.log(e)
  })
} catch (e) {
  console.log(e)
}
```

## Что показываем пользователю

### ✅ Пользовательские ошибки (понятные сообщения)
```javascript
// Проверка прав доступа
await ctx.answerCbQuery('Только создатель может закрыть лот!');

// Валидация данных
await ctx.answerCbQuery('Лот не найден');
await ctx.answerCbQuery('Лот уже закрыт!');

// Ограничения Telegram API
await ctx.replyWithHTML(`Из-за ограничений телеграма тебе нужно использовать /start ещё раз...`);

// Валидация в сценах
await lotsUtils.updateLotCreationMessage(ctx, 
  `⚠️ <b>Ожидаю от тебя число! Не могу распознать, что ты прислал</b> ⚠️\n\n...`
);
```

### ❌ Технические ошибки (общие сообщения)
```javascript
// Общие ошибки в действиях
await ctx.reply('Ошибка при закрытии лота.');
await ctx.reply('Ошибка при выходе из лота.');
await ctx.reply('Ошибка при присоединении к лоту.');
```

### 🚫 Отсутствие обработки
```javascript
// В сценах - только логирование, без сообщения пользователю
} catch (e) {
  console.error('Failed to handle text message:', e);
  // НЕТ ctx.reply или ctx.answerCbQuery!
}
```

## Что логируем

### ✅ Обязательное логирование
```javascript
// Ошибки в действиях
console.error('Failed to close lot:', error);
console.error('Failed to handle text message:', e);
console.error('Failed to change currency:', e);

// Ошибки Telegram API
console.log("Error! Couldn't reply to a message, just sending a message. Reason:")
console.log(error)

// Ошибки в indexator-creator
console.log(e) // множественные места
```

### ❌ Недостатки текущего логирования
1. **НЕ используется функция `logError`** - только `console.log/error`
2. **Отсутствует контекст** - нет информации о пользователе, команде, чате
3. **Нет структурированного логирования** - все в console.log
4. **Нет уровней логирования** - все ошибки одинаково важны

## Проблемы в текущей реализации

### 1. Неиспользуемая функция logError
```javascript
// modules/util.js - функция определена и экспортируется, но НЕ используется
function logError (ctx, error) { ... }
// В module.exports ЕСТЬ logError, но в коде не используется!
```

### 2. Непоследовательная обработка ошибок
```javascript
// В одних местах - try/catch с сообщением пользователю
try {
  // логика
} catch (error) {
  console.error('Failed to close lot:', error);
  await ctx.reply('Ошибка при закрытии лота.');
}

// В других местах - только логирование
try {
  // логика
} catch (e) {
  console.error('Failed to handle text message:', e);
  // НЕТ сообщения пользователю!
}
```

### 3. Отсутствие обработки в критических местах
```javascript
// modules/indexator-creator/triggers/main.js - множественные try/catch без fallback
try {
  ctx.telegram.editMessageCaption(...).catch(e => { console.log(e) })
} catch (e) {
  console.log(e)
}
```

### 4. Нет централизованного обработчика
- Каждый модуль обрабатывает ошибки по-своему
- Нет единого стандарта для пользовательских сообщений
- Нет мониторинга частых ошибок

## Рекомендации по улучшению

### 1. Использовать функцию logError
```javascript
// modules/util.js - уже экспортируется
module.exports = {
  // ... существующие экспорты
  logError, // ✅ УЖЕ ЕСТЬ
}

// В обработчиках использовать
const { logError } = require('../../util');

try {
  // логика
} catch (error) {
  logError(ctx, error);
  await ctx.reply('Произошла ошибка. Попробуйте позже.');
}
```

### 2. Стандартизировать обработку ошибок
```javascript
// Создать функцию для пользовательских ошибок
function handleUserError(ctx, error, userMessage = 'Произошла ошибка. Попробуйте позже.') {
  logError(ctx, error);
  
  if (ctx.callbackQuery) {
    return ctx.answerCbQuery(userMessage);
  } else {
    return ctx.reply(userMessage);
  }
}

// Использовать везде
try {
  // логика
} catch (error) {
  await handleUserError(ctx, error, 'Ошибка при закрытии лота.');
}
```

### 3. Добавить типизацию ошибок
```javascript
class BotError extends Error {
  constructor(message, code, userMessage) {
    super(message);
    this.code = code;
    this.userMessage = userMessage;
  }
}

// Использовать
if (!lotData) {
  throw new BotError('Lot not found', 'LOT_NOT_FOUND', 'Лот не найден');
}
```

### 4. Улучшить мониторинг
```javascript
// Добавить метрики ошибок
const errorMetrics = {
  total: 0,
  byType: {},
  byUser: {},
  byCommand: {}
};

function logErrorWithMetrics(ctx, error) {
  logError(ctx, error);
  
  errorMetrics.total++;
  errorMetrics.byType[error.constructor.name] = (errorMetrics.byType[error.constructor.name] || 0) + 1;
  // ... другие метрики
}
```

## Конкретные примеры исправлений

### Пример 1: Исправление сцены price.js
```javascript
// БЫЛО:
lotScenePriceStage.on('text', async (ctx) => {
  try {
    const price = parseFloat(ctx.message.text);
    // ... логика
  } catch (e) {
    console.error('Failed to handle text message:', e);
    // НЕТ сообщения пользователю!
  }
});

// СТАЛО:
const { logError } = require('../../util');

lotScenePriceStage.on('text', async (ctx) => {
  try {
    const price = parseFloat(ctx.message.text);
    // ... логика
  } catch (e) {
    logError(ctx, e);
    await lotsUtils.updateLotCreationMessage(ctx, 
      `❌ Произошла ошибка при обработке сообщения. Попробуйте еще раз.`,
      // ... меню
    );
  }
});
```

### Пример 2: Исправление action close.js
```javascript
// БЫЛО:
} catch (error) {
  console.error('Failed to close lot:', error);
  await ctx.reply('Ошибка при закрытии лота.');
}

// СТАЛО:
const { logError } = require('../../util');

} catch (error) {
  logError(ctx, error);
  await ctx.answerCbQuery('❌ Ошибка при закрытии лота. Попробуйте позже.');
}
```

### Пример 3: Исправление indexator-creator
```javascript
// БЫЛО:
try {
  ctx.telegram.editMessageCaption(...).catch(e => { console.log(e) })
} catch (e) {
  console.log(e)
}

// СТАЛО:
const { logError } = require('../../util');

try {
  await ctx.telegram.editMessageCaption(...);
} catch (e) {
  logError(ctx, e);
  // Для indexator-creator можно не показывать пользователю, только логировать
}
```

### Пример 4: Создание централизованного обработчика
```javascript
// modules/util.js - добавить функцию
function handleUserError(ctx, error, userMessage = 'Произошла ошибка. Попробуйте позже.') {
  logError(ctx, error);
  
  if (ctx.callbackQuery) {
    return ctx.answerCbQuery(userMessage);
  } else {
    return ctx.reply(userMessage);
  }
}

// Экспортировать
module.exports = {
  // ... существующие экспорты
  logError,
  handleUserError, // ✅ НОВАЯ ФУНКЦИЯ
}

// Использовать везде
const { handleUserError } = require('../../util');

try {
  // логика
} catch (error) {
  await handleUserError(ctx, error, 'Ошибка при закрытии лота.');
}
```

## План миграции

### Этап 1: Подготовка (1-2 дня)
1. ✅ Добавить `handleUserError` в `modules/util.js`
2. ✅ Создать типы ошибок `BotError`
3. ✅ Добавить метрики ошибок

### Этап 2: Критические модули (3-5 дней)
1. Исправить `modules/lots/actions/` - все действия с лотами
2. Исправить `modules/admin/actions/` - админские действия
3. Исправить `modules/users/actions/` - пользовательские действия

### Этап 3: Сцены (2-3 дня)
1. Исправить `modules/lots/scenes/` - все сцены лотов
2. Исправить `modules/admin/scenes/` - админские сцены
3. Исправить `modules/users/scenes/` - пользовательские сцены

### Этап 4: Специальные модули (1-2 дня)
1. Исправить `modules/indexator-creator/` - убрать множественные try/catch
2. Исправить `modules/polls/` - опросы
3. Исправить `modules/payments/` - платежи

### Этап 5: Тестирование (1 день)
1. Протестировать все исправленные модули
2. Проверить логирование
3. Проверить пользовательские сообщения

## Типы ошибок по приоритету

### 🔴 Критические (показываем пользователю + детальное логирование)
- Ошибки Telegram API (rate limit, token)
- Ошибки Redis подключения
- Ошибки валидации критических данных

### 🟡 Важные (показываем пользователю + логирование)
- Ошибки бизнес-логики
- Ошибки доступа к данным
- Ошибки отправки сообщений

### 🟢 Информационные (только логирование)
- Ошибки UI (неправильные кнопки)
- Ошибки парсинга неважных данных
- Ожидаемые ошибки (пользователь отменил)

### ⚪ Игнорируемые (не логируем)
- Ошибки от отклоненных пользователей
- Ошибки в приватных чатах от неавторизованных
- Ошибки устаревших команд 