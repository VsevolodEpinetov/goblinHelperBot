//#region imports
const { Telegraf, Markup, Telegram, Scenes, session } = require('telegraf');
const { telegrafThrottler } = require('telegraf-throttler');
require('dotenv').config();
const bot = new Telegraf(process.env.TOKEN)
const throttler = telegrafThrottler();
bot.use(throttler);
const telegram = new Telegram(process.env.TOKEN)
const SETTINGS = require('./settings.json')
const STUDIOS = require('./studios.json')

const { createCanvas, loadImage } = require('canvas')
const fs = require('fs');

const util = require('./modules/util.js');
//#endregion

//#region Redis
// --------------------------------------------------------------------------
// 1. Redis, sessions
// --------------------------------------------------------------------------
const RedisSession = require('telegraf-session-redis-upd')
const sessionInstance = new RedisSession();
const SESSIONS = require('./modules/sessions.js');
const { default: axios } = require('axios');
bot.use(
  SESSIONS.GLOBAL_SESSION,
  SESSIONS.CHANNELS_SESSION,
  SESSIONS.USER_SESSION,
  SESSIONS.CHAT_SESSION
)
//#endregion



const replyToTheMessage = (ctx, message, replyToID) => {
  ctx.replyWithHTML(message, {
    reply_to_message_id: replyToID
  }).catch((error) => {
    console.log("Error! Couldn't reply to a message, just sending a message. Reason:")
    console.log(error)
    ctx.replyWithHTML(message)
  })
}

//#region Register Scenes, Init Stage
const stage = new Scenes.Stage([
  require('./modules/lots/scenes/photo'),
  require('./modules/lots/scenes/price'),
  require('./modules/lots/scenes/link'),
  require('./modules/lots/scenes/author'),
  require('./modules/lots/scenes/name'),
  require('./modules/payments/scenes/proof'),
  require('./modules/payments/scenes/month_name'),
  require('./modules/payments/scenes/month_invitation'),
  require('./modules/payments/scenes/month_invitation_plus'),
]);
bot.use(session());
bot.use(stage.middleware());

bot.use(require('./modules/lots'))
bot.use(require('./modules/polls'))
bot.use(require('./modules/commands'))
bot.use(require('./modules/indexator-creator'))
bot.use(require('./modules/payments'))
//#endregion

bot.on('chat_join_request', async ctx => {
  let monthName = '';
  let isPlus = false;

  for (const monthNameInObj in ctx.globalSession.months) {
    if (!ctx.globalSession.months[monthNameInObj].chats) {
      await ctx.telegram.sendMessage(ctx.from.id, 'Придётся подождать чуть-чуть, небольшие организационные неполадки. Админу уже сообщил, он объявит, когда всё починят')
      await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, `Ты не объявил чаты для ${monthNameInObj}, йопта`)
      return;
    }

    if (ctx.globalSession.months[monthNameInObj].chats.base == ctx.chat.id) {
      monthName = monthNameInObj;
    }
    if (ctx.globalSession.months[monthNameInObj].chats.plus == ctx.chat.id) {
      monthName = monthNameInObj;
      isPlus = true;
    }
  }

  if (ctx.globalSession.months[monthName].members[ctx.from.id]) {
    if (isPlus) {
      if (ctx.globalSession.months[monthName].members[ctx.from.id].plus) {
        await ctx.approveChatJoinRequest(ctx.from.id);
        await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, `Добавил ${ctx.from.id} в плюсовый ${monthName}`)
      } else {
        await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, `${ctx.from.id} хотел в плюсовый ${monthName}, но у него не подтверждена оплата`)
      }
    } else {
      if (ctx.globalSession.months[monthName].members[ctx.from.id].paid) {
        await ctx.approveChatJoinRequest(ctx.from.id);
        await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, `Добавил ${ctx.from.id} в базовый ${monthName}`)
      } else {
        await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, `${ctx.from.id} хотел в базовый ${monthName}, но у него не подтверждена оплата`)
      }
    }
  } else {
    console.log("Not found the member")
  }
})

bot.hears(/(^[гГ]облин[!.]?$)/g, (ctx) => {
  replyToTheMessage(ctx, `Слушаю, господин${ctx.message.from.first_name && ' ' + ctx.message.from.first_name}! Если Вы забыли, что я умею - напиши "Гоблин, что ты умеешь?"`, ctx.message.message_id)
})

bot.hears(/(^[гГ]облин[,]? как тебя зовут?\??$)/g, (ctx) => {
  replyToTheMessage(ctx, `Если вам очень интересно - посмотрите в моём профиле :)`, ctx.message.message_id)
})

bot.hears(/(^[гГ]облин[,]? что ты умеешь?\??$)/g, (ctx) => {
  replyToTheMessage(ctx, `Сейчас я умею подсказывать, сколько долларов в разных валютах! Например, спросите меня "Гоблин, сколько 5 долларов в рублях?"`, ctx.message.message_id)
})

bot.hears(/^[гГ]облин[,]? сколько \$?([0-9]*[.])?[0-9]+ (доллар(ов|а) |бакс(ов|а) | )?в [а-яА-Я]+\??$/g, (ctx) => {
  let amount = ctx.message.text.split('сколько ')[1].split(' ')[0];
  if (amount.indexOf('$') > -1) amount = amount.split('$')[1];
  amount = parseFloat(amount);

  let newCurrency = ctx.message.text.split(' в ')[1];
  if (newCurrency.indexOf('?') > -1) newCurrency = newCurrency.split('?')[0];

  if (newCurrency == 'рублях' || newCurrency == 'копейках' || newCurrency == 'деревянных' || newCurrency == 'деревяных') {
    let newValue = Math.ceil(amount * SETTINGS.EXCHANGE_RATE * SETTINGS.SPECIAL_RATE);
    let word = 'руб.'
    if (newCurrency == 'копейках') {
      newValue = Math.ceil(amount * SETTINGS.EXCHANGE_RATE * SETTINGS.SPECIAL_RATE * 100);
      word = 'коп.'
    }

    replyToTheMessage(ctx, `Тэкс, ну, получается, $${amount} это ${newValue} ${word}!`, ctx.message.message_id)
  } else {
    replyToTheMessage(ctx, `Чего? Какие ${newCurrency}? Яж необразованный, я не знаю такой валюты!`, ctx.message.message_id)
  }
})

bot.command('rch', ctx => {
  ctx.channelsSession = {};
  ctx.channelsSession.channels = {};
  ctx.reply('done');
})

bot.command('shch', async ctx => {
  console.log(JSON.stringify(ctx.channelsSession))
})

bot.catch((error) => {
  console.log(error);
})

// --------------------------------------------------------------------------
// 4. Service
// --------------------------------------------------------------------------
bot.launch()
// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))