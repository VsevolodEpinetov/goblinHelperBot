const Telegraf = require('telegraf');
const { Composer, Markup } = require("telegraf");
const SETTINGS = require('../settings.json')

const fs = require('fs');
const path = require('path');

const date = require('./date');
const { getUser } = require('./db/helpers');
const colors = require('./colors.js')


function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

function splitMenu (menu, rowSize = 5) {
  const result = [];

  if (menu.length > rowSize) {
    for (let i = 0; i < menu.length; i += rowSize) {
      // Берем кусочек массива от i до i + chunkSize
      result.push(menu.slice(i, i + rowSize));
    }
  } else {
    result.push(menu);
  }

  return result;
}

function getUserMessage (ctx, userData) {
  const tickets = Math.floor(userData.purchases.groups.plus.length / 3) * 2 - userData.purchases.ticketsSpent;
  let purchasedCurrent = userData.purchases.groups.regular.indexOf(`${ctx.globalSession.current.year}_${ctx.globalSession.current.month}`) > -1;
  let notPurchasedPart = '';
  if (!purchasedCurrent) {
    notPurchasedPart = `⚠️ НЕ ОПЛАЧЕН ⚠️\n\n`
  } else {
    const plusIsPurchased = userData.purchases.groups.plus.indexOf(`${ctx.globalSession.current.year}_${ctx.globalSession.current.month}`) > -1;
    notPurchasedPart = `✅ Оплачено${plusIsPurchased ? '' : ' (без ➕)\n\n'}`
  }

  return  `Привет, ${userData.first_name}!\n\n` + 
          `🗓 <b>Текущий месяц: </b>${ctx.globalSession.current.year}-${ctx.globalSession.current.month}\n`+
          notPurchasedPart +
          `💰 <b>Баланс: </b>${userData.purchases.balance}₽\n` +
          `🎟 <b>Билетики: </b>${tickets}\n\n`+
          `<i>Выбери один из пунктов меню</i>`;
}

// Enhanced UX Functions
function createStatusCard(ctx, userData) {
  const tickets = Math.floor(userData.purchases.groups.plus.length / 3) * 2 - userData.purchases.ticketsSpent;
  const currentPeriod = `${ctx.globalSession.current.year}_${ctx.globalSession.current.month}`;
  const hasRegular = userData.purchases.groups.regular.indexOf(currentPeriod) > -1;
  const hasPlus = userData.purchases.groups.plus.indexOf(currentPeriod) > -1;
  
  // Calculate trends and status
  const balanceTrend = userData.purchases.balance > 0 ? "💰" : "💸";
  const ticketStatus = tickets > 0 ? "🎟" : "🎫";
  const monthStatus = hasRegular ? (hasPlus ? "✅" : "✅") : "⚠️";
  
  return `🎯 <b>СТАТУС АККАУНТА</b>\n\n` +
         `${monthStatus} <b>Текущий месяц:</b> ${ctx.globalSession.current.year}-${ctx.globalSession.current.month}\n` +
         `${hasRegular ? (hasPlus ? '✅ Оплачено с ➕' : '✅ Оплачено без ➕') : '⚠️ НЕ ОПЛАЧЕН'}\n\n` +
         `${balanceTrend} <b>Баланс:</b> ${userData.purchases.balance}₽\n` +
         `${ticketStatus} <b>Билетики:</b> ${tickets}\n\n` +
         `📊 <b>Активные подписки:</b> ${userData.purchases.groups.regular.length}\n` +
         `⭐ <b>Плюс подписки:</b> ${userData.purchases.groups.plus.length}\n` +
         `🎁 <b>Кикстартеры:</b> ${userData.purchases.kickstarters.length}`;
}

function createSmartMenu(ctx, userData) {
  const currentPeriod = `${ctx.globalSession.current.year}_${ctx.globalSession.current.month}`;
  const hasCurrentMonth = userData.purchases.groups.regular.indexOf(currentPeriod) > -1;
  const hasPlus = userData.purchases.groups.plus.indexOf(currentPeriod) > -1;
  const tickets = Math.floor(userData.purchases.groups.plus.length / 3) * 2 - userData.purchases.ticketsSpent;
  
  // Primary actions based on current status
  let primaryActions = [];
  
  if (!hasCurrentMonth) {
    primaryActions.push(['💳 Оплатить текущий месяц', 'sendPayment_currentMonth']);
  } else if (!hasPlus) {
    primaryActions.push(['⭐ Добавить ➕ к месяцу', 'addPlusToCurrentMonth']);
  }
  
  if (tickets > 0) {
    primaryActions.push(['🎟 Использовать билетик', 'useTicket']);
  }
  
  // Always available actions
  const standardActions = [
    ['📅 Подписки', 'userMonths'],
    ['🚀 Кикстартеры', 'userKickstarters'],
    ['⚔️ Мои рейды', 'userRaids'],
    ['💰 Баланс и билетики', 'userBalanceTickets'],
    ['📊 Статистика', 'userStats']
  ];
  
  // Secondary actions
  const secondaryActions = [
    ['🚧 Релизы', 'requestRelease'],
    ['🚧 Коллекция', 'userCollections'],
    ['🚧 Индивидуальный выкуп', 'requestBuyout']
  ];
  
  // Quick actions for power users
  const quickActions = [];
  if (userData.roles.includes('polls')) {
    quickActions.push(['🗳️ Голосования', 'adminPolls']);
  }
  
  return {
    primary: primaryActions.length > 0 ? primaryActions : [standardActions[0]],
    standard: standardActions,
    secondary: secondaryActions,
    quick: quickActions
  };
}

function createInteractiveMenu(ctx, userData) {
  const smartMenu = createSmartMenu(ctx, userData);
  const statusCard = createStatusCard(ctx, userData);
  
  // Build the complete menu structure
  let allButtons = [];
  
  // Add primary actions if they exist
  if (smartMenu.primary.length > 0) {
    allButtons.push(...smartMenu.primary.map(btn => [Markup.button.callback(btn[0], btn[1])]));
  }
  
  // Add standard actions in rows of 2
  const standardRows = [];
  for (let i = 0; i < smartMenu.standard.length; i += 2) {
    const row = smartMenu.standard.slice(i, i + 2).map(btn => 
      Markup.button.callback(btn[0], btn[1])
    );
    standardRows.push(row);
  }
  allButtons.push(...standardRows);
  
  // Add secondary actions
  if (smartMenu.secondary.length > 0) {
    const secondaryRows = [];
    for (let i = 0; i < smartMenu.secondary.length; i += 2) {
      const row = smartMenu.secondary.slice(i, i + 2).map(btn => 
        Markup.button.callback(btn[0], btn[1])
      );
      secondaryRows.push(row);
    }
    allButtons.push(...secondaryRows);
  }
  
  // Add quick actions
  if (smartMenu.quick.length > 0) {
    allButtons.push(smartMenu.quick.map(btn => Markup.button.callback(btn[0], btn[1])));
  }
  
  // Add utility buttons
  allButtons.push([
    Markup.button.callback('🔄 Обновить', 'refreshUserStatus'),
    Markup.button.callback('❓ Помощь', 'userHelp')
  ]);
  
  return {
    message: statusCard,
    keyboard: allButtons
  };
}

function isSuperUser (userId) {
  if (userId == SETTINGS.CHATS.EPINETOV || userId == SETTINGS.CHATS.GLAVGOBLIN || userId == SETTINGS.CHATS.ANN) {
    return true;
  } else {
    return false;
  }
}

function getUserButtons (ctx, userData) {
  let purchasedCurrent = userData.purchases.groups.regular.indexOf(`${ctx.globalSession.current.year}_${ctx.globalSession.current.month}`) > -1;
  let notPurchasedPart = [];
  if (!purchasedCurrent) {
    notPurchasedPart = [
      Markup.button.callback('👉 Оплатить текущий месяц 👈', `sendPayment_currentMonth`)
    ]
  }

  return [
    [
      Markup.button.callback('Подписка', `userMonths`),
      Markup.button.callback('🚧 Релизы', `requestRelease`)
    ],
    [
      Markup.button.callback('Кикстартеры', `userKickstarters`),
      Markup.button.callback('🚧 Коллекция', `userCollections`)
    ],
    [
      Markup.button.callback('🚧 Индивидуальный выкуп', `requestBuyout`)
    ],
    notPurchasedPart
  ]
}

function getUserMenu (userId) {
  const buttons = [
    [
      Markup.button.callback(`Месяцы`, `showUserMonths_${userId}`),
      Markup.button.callback(`Кикстартеры`, `showUserKickstarters_${userId}`),
      Markup.button.callback(`Коллекции`, `showUserCollections_${userId}`),
    ],
    [
      Markup.button.callback(`Баланс`, `changeBalance_${userId}`),
      Markup.button.callback(`Билетики`, `changeTicketsSpent_${userId}`)
    ],
    [
      Markup.button.callback(`Роли`, `changeUserRoles_${userId}`)
    ],
    [
      Markup.button.callback('←', `adminParticipants`),
      Markup.button.callback('В начало', `adminMenu`),
    ]
  ];

  return buttons;
}

async function getUserTickets (ctx, userId) {
  const userData = await getUser(userId);
  if (!userData) return 0;
  
  const tickets = Math.floor(userData.purchases.groups.plus.length / 3) * 2 - userData.purchases.ticketsSpent;

  return tickets;
}

async function getUserDescription (ctx, userId) {
  const userData = await getUser(userId);
  if (!userData) return 'Пользователь не найден';
  
  const tickets = await getUserTickets(ctx, userId);

  const message = `Информация о пользователе\n` +
                  `\n` + 
                  `<b>ID:</b> ${userData.id}\n` + 
                  `<b>Username: </b>${userData.username != 'not_set' ? '@' : ''}${userData.username}\n` + 
                  `<b>Имя:</b> ${userData.first_name} ${userData.last_name}\n` + 
                  `\n` + 
                  `<b>Роли:</b> ${userData.roles.join(", ")}\n` + 
                  `<b>Месяцы:</b> ${userData.purchases.groups.regular.length}+${userData.purchases.groups.plus.length}${userData.purchases.groups.plus.length > 0 ? ` (${tickets}🎟)` : ''}\n` + 
                  `<b>Кикстартеры:</b> ${userData.purchases.kickstarters.length}\n` + 
                  `<b>Коллекции:</b> ${userData.purchases.collections.length}\n` + 
                  `<b>Баланс:</b> ${userData.purchases.balance}`;

  return message;
}

function getAllFilesFromFolder (dir) {
  console.log('📁 Scanning directory:', dir);
  const files = fs.readdirSync(dir);
  let allFiles = [];

  files.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      console.log('📁 Found subdirectory:', file);
      allFiles = allFiles.concat(getAllFilesFromFolder(fullPath));  // Рекурсивно проходим по подпапкам
    } else {
      console.log('📄 Found file:', file);
      allFiles.push(fullPath);  // Добавляем путь к файлу
    }
  });

  console.log('📁 Total files found in', dir, ':', allFiles.length);
  return allFiles;
}

function hideMenu (ctx) {
  try {
    ctx.editMessageReplyMarkup({
      reply_markup: {}
    });
  }
  catch (err) { }
}

function log (ctx) {
  let message = `\x1b[34m[INFO]${colors.reset} \x1b[36m${date.getTimeForLogging()}${colors.reset} `
  if (typeof ctx.update.callback_query === 'undefined') {
    if (typeof ctx.message.text !== 'undefined') {
      if (ctx.message.text[0] === '/') {
        message += `@${ctx.message.from.username} (${ctx.message.from.id ? ctx.message.from.id : ''}) has issued command ${colors.green}'/${ctx.message.text.split('/')[1]}'${colors.reset} `
        if (ctx.message.chat.type == 'private') {
          message += `in private chat`
        } else {
          message += `in chat named '${ctx.message.chat.title}' ${colors.white}(id ${ctx.message.chat.id})${colors.reset}`
        }
      }
    }
  } else {
    message += `@${ctx.update.callback_query.from.username} has called an action ${colors.green}'${ctx.callbackQuery.data}'${colors.reset} `
    if (ctx.update.callback_query.message.chat.type == 'private') {
      message += `in private chat`
    } else {
      message += `in chat named '${ctx.update.callback_query.message.chat.title}' ${colors.white}(id ${ctx.update.callback_query.message.chat.id})${colors.reset}`
    }
  }
  console.log(message);
}

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

function handleUserError(ctx, error, userMessage = 'Произошла ошибка. Попробуйте позже.') {
  logError(ctx, error);
  
  if (ctx.callbackQuery) {
    return ctx.answerCbQuery(userMessage);
  } else {
    return ctx.reply(userMessage);
  }
}


function getRandomInt (min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isAdmin (telegramUserID) {
  const isAnAdmin = telegramUserID == SETTINGS.CHATS.EPINETOV ||
    telegramUserID == SETTINGS.CHATS.GLAVGOBLIN ||
    telegramUserID == SETTINGS.CHATS.ALEKS ||
    telegramUserID == SETTINGS.CHATS.ARTYOM;

  return isAnAdmin;
}


function getCommandParameter (ctx) {
  return option = ctx.message.text.split(/ +/)[1];
}






  /*async function splitMessageAndReply (ctx, message, menu) {
    if (message.length < settings.TelegramCharactersLimit) {
      ctx.replyWithHTML(message);
    } else {
      var amountOfMessagesNeeded = ((message.length - (message.length % settings.TelegramCharactersLimit)) / settings.TelegramCharactersLimit) + 1;
      ctx.reply('Сообщение получилось слишком большое, разбито на ' + amountOfMessagesNeeded + ' части.');
      await sleep(500)
      for (var i = 0; i < amountOfMessagesNeeded; i++) {
        if (typeof menu !== 'undefined') {
          if (i === amountOfMessagesNeeded - 1) {
            ctx.replyWithHTML(message.substring(0, settings.TelegramCharactersLimit), menu);
          } else {
            ctx.replyWithHTML(message.substring(0, settings.TelegramCharactersLimit));
            await sleep(1000)
            message = message.substring(settings.TelegramCharactersLimit, message.length);
          }
        } else {
          ctx.replyWithHTML(message.substring(0, settings.TelegramCharactersLimit));
          await sleep(1000)
          message = message.substring(settings.TelegramCharactersLimit, message.length);
        }
      }
    }
  }*/

module.exports = {

  splitMenu,
  getUserMessage,
  getUserButtons,
  getAllFilesFromFolder,
  hideMenu,
  sleep,
  log,
  logError,
  handleUserError,
  getRandomInt,
  isAdmin,
  getCommandParameter,
  isSuperUser,
  getUserMenu,
  getUserDescription,
  getUserTickets,
  createStatusCard,
  createSmartMenu,
  createInteractiveMenu,
  messageRouter: require('./util/messageRouter')


}
