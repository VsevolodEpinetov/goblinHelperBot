const Telegraf = require('telegraf');
const { Composer, Markup } = require("telegraf");

const fs = require('fs');
const path = require('path');


const date = require('./date');
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
      Markup.button.callback('Релизы', `requestRelease`)
    ],
    [
      Markup.button.callback('Кикстартеры', `userKickstarters`),
      Markup.button.callback('Коллекция', `userCollections`)
    ],
    [
      Markup.button.callback('Индивидуальный выкуп', `requestBuyout`)
    ],
    notPurchasedPart
  ]
}

function getAllFilesFromFolder (dir) {
  const files = fs.readdirSync(dir);
  let allFiles = [];

  files.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      allFiles = allFiles.concat(getAllFilesFromFolder(fullPath));  // Рекурсивно проходим по подпапкам
    } else {
      allFiles.push(fullPath);  // Добавляем путь к файлу
    }
  });

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


function getRandomInt (min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isAdmin (telegramUserID) {
  const isAnAdmin = telegramUserID == SETTINGS.CHATS.EPINETOV ||
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
  getRandomInt,
  isAdmin,
  getCommandParameter


}
