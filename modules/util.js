const Telegraf = require('telegraf')

const date = require('./date');
const colors = require('./colors.js')


function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

module.exports = {


  hideMenu: function (ctx) {
    try {
      ctx.editMessageReplyMarkup({
        reply_markup: {}
      });
    }
    catch (err) {}
  },


  sleep: function (ms) {
    return new Promise(resolve => {
      setTimeout(resolve, ms)
    })
  },

  log: function (ctx) {
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
  },

  logError: function (ctx, error) {
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
  },


  getRandomInt: function (min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },


  /*splitMessageAndReply: async function (ctx, message, menu) {
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
  },*/


  getCommandParameter: function (ctx) {
    return option = ctx.message.text.split(/ +/)[1];
  },


  checkAlivenessAndLog: function (ctx, callback) {
    ctx.utility.botWasAliveAt = date.getCurrent().timestamp;
    var message = `${colors.blue}[INFO] ${colors.cyan}${date.getCurrent().string.hhmmss}\x1b${colors.reset} `

    if (ctx.message) {
      if ((ctx.utility.botWasAliveAt - ctx.message.date) > 10) {
        var message = `${colors.red}[ERROR] ${colors.cyan}${date.getCurrent().string.hhmmss} ${colors.red}Too old `
        if (ctx.message.text[0] === '/') {
          message += `command`
        } else {
          message += 'message'
        }
        message += ` was ignored${colors.reset}`
        console.log(message);
        return;
      } else {

        if (ctx.message.text) {

          if (ctx.message.text[0] === '/') {
            var command = ctx.message.text.split('/')[1];
            if (ctx.message.text.indexOf(' ') > 0) {
              command = command.split(' ')[0];
            }

            message += `@${ctx.message.from.username} has executed the command ${colors.green}'/${command}'${colors.reset} `;

          } else {

            message += `@${ctx.message.from.username} has triggered the bot with the text ${colors.green}'${ctx.message.text}'${colors.reset} `;

          }


          if (ctx.message.chat.type == 'private') {
            message += `in the private chat`
          } else {
            message += `in the chat named '${ctx.message.chat.title}' ${colors.white}(id ${ctx.message.chat.id})${colors.reset}`
          }

        }

        console.log(message);
        return callback(ctx);
      }
    }


    if (ctx.update.callback_query) {
      message += `@${ctx.update.callback_query.from.username} has called an action ${colors.green}'${ctx.callbackQuery.data}'${colors.reset} `
      if (ctx.update.callback_query.message.chat.type == 'private') {
        message += `in the private chat`
      } else {
        message += `in the chat named '${ctx.update.callback_query.message.chat.title}' ${colors.white}(id ${ctx.update.callback_query.message.chat.id})${colors.reset}`
      }
      console.log(message);
      return callback(ctx);
    }

  },

  createMenu: function (data) {
    var rows = [];
    var amountOfColumns = 0;

    data.forEach((row, rowID) => {
      if (row.length > amountOfColumns) amountOfColumns = row.length;

      row.forEach((menuItem, itemID) => {
        if (!rows[rowID]) rows[rowID] = [];
        rows[rowID].push(Telegraf.Markup.callbackButton(`${menuItem.name}`, `${menuItem.action}`))
      });
    });

    //Telegraf.Markup.callbackButton(`🦸‍♂️ ${parseInt(key) + 1}`, `actionShowMenuTaskDuty_localID${parseInt(key) + 1}_globalID${task.id}`)

    return Telegraf.Extra.HTML().markup((m) => m.inlineKeyboard(rows, { columns: amountOfColumns }));
  },



  /*onlyInTestChat: function (ctx, callback) {
    if (ctx.message) {
      if (ctx.message.chat.id === settings.chats.test.id) {
        return callback(ctx);
      } else {
        return;
      }
    }

    if (ctx.update.callback_query) {
      if (ctx.update.callback_query.chat.id === settings.chats.test.id) {
        return callback(ctx);
      } else {
        return;
      }
    }
  }*/
}
