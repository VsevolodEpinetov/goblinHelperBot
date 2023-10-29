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
  //
  require('./modules/emporium/scenes/type'),
  require('./modules/emporium/scenes/classes'),
  require('./modules/emporium/scenes/races'),
  require('./modules/emporium/scenes/releaseName'),
  require('./modules/emporium/scenes/sex'),
  require('./modules/emporium/scenes/studioName'),
  require('./modules/emporium/scenes/weapons'),
  require('./modules/emporium/scenes/photo'),
  require('./modules/emporium/scenes/photoExact'),
  require('./modules/emporium/scenes/whFactions'),
  require('./modules/emporium/scenes/whType'),
]);
bot.use(session());
bot.use(stage.middleware());

bot.use(require('./modules/lots'))
bot.use(require('./modules/polls'))
bot.use(require('./modules/commands'))
bot.use(require('./modules/emporium'))
//#endregion

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

bot.on('channel_post', async (ctx) => {
  if (!ctx.channelPost.document && (typeof ctx.channelPost.text !== undefined || typeof ctx.channelPost.caption !== undefined)) {
    let localChannels;
    await sessionInstance.getSession('channelsSession').then(session => {
      localChannels = session;
    });
    if (!localChannels) {
      localChannels = {};
    }
    if (!localChannels.channels) {
      console.log('defining channels')
      localChannels.channels = {};
    }

    const channelID = ctx.channelPost.chat.id;
    const messageText = ctx.channelPost.text || ctx.channelPost.caption;

    if (!localChannels.channels[channelID]) {
      if (messageText === 'start') {
        localChannels.channels[channelID] = {
          indexers: [],
          studios: [],
          locked: false,
          type: 'archive'
        };
        ctx.replyWithHTML('Бип буп, записал канал. Присылай индексаторы \n\nПришли любое сообщение, которое будет содержать хотя бы 1 эмодзи "🔸" - я запомню его как Индексатор. \n\n<i>Рекомендую прислать минимум <b>2</b> таких сообщения</i>')
      }
      sessionInstance.saveSession('channelsSession', localChannels);
    } else if (messageText === 'stop') {
      ctx.replyWithHTML('🖐 Индексаторы в ручном режиме')
      localChannels.channels[channelID].locked = true;
      sessionInstance.saveSession('channelsSession', localChannels);
    } else if (messageText === 'start') {
      ctx.replyWithHTML('🤖 Индексаторы в автоматическом режиме')
      localChannels.channels[channelID].locked = false;
      sessionInstance.saveSession('channelsSession', localChannels);
    } else if (messageText === 'switch') {
      if (localChannels.channels[channelID].type === 'collection') {
        localChannels.channels[channelID].type = 'archive';
        ctx.replyWithHTML('Режим - архив БГ')
      } else if (localChannels.channels[channelID].type === 'archive') {
        localChannels.channels[channelID].type = 'collection';
        ctx.replyWithHTML('Режим - коллекция')
      }
      sessionInstance.saveSession('channelsSession', localChannels);
    } else if (!localChannels.channels[channelID].locked) {
      if (!localChannels.channels[channelID].type) localChannels.channels[channelID].type = 'archive';
      if (messageText.indexOf('🔸') < 0) {
        if (localChannels.channels[channelID].indexers.length === 0) {
          ctx.replyWithHTML('Нет ни одного записанного индексатора! \n\nПришли любое сообщение, которое будет содержать хотя бы 1 эмодзи "🔸" - я запомню его как Индексатор. \n\n<i>Рекомендую прислать минимум <b>2</b> таких сообщения</i>');
        } else {
          let studioName = '';
          let monthName = messageText.split('\n')[0]?.split(' (')[1]?.split(' ')[0] || 'пыпы';
          let year = messageText.split('\n')[0]?.split(' (')[1]?.split(' ')[1]?.split(')')[0] || '2222';
          const months = {
            'январь': '01',
            'февраль': '02',
            'март': '03',
            'апрель': '04',
            'май': '05',
            'июнь': '06',
            'июль': '07',
            'август': '08',
            'сентябрь': '09',
            'октябрь': '10',
            'ноябрь': '11',
            'декабрь': '12',
            'пыпы': '88'
          }
          let releaseName = '';
          if (messageText.indexOf('\n') > 0) {
            studioName = messageText.split('\n')[0].split(' (')[0];
            if (year == '2222' || months[monthName] == '88') {
              releaseName = `${messageText.split('\n')[1]}`;
            } else {
              releaseName = `${year}${months[monthName]} - ${messageText.split('\n')[1]}`;
            }
          } else {
            studioName = messageText.split(' (')[0];
            releaseName = `${year}${months[monthName]}`;
          }

          let copy = localChannels.channels[channelID].studios;
          const newPostInfo = {
            name: studioName,
            release: releaseName,
            messageID: ctx.channelPost.message_id
          }
          copy.push(newPostInfo)
          copy.sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));

          let newText = ``;
          if (copy.length < 100) {
            newText = `🔸 <b>Индексатор 1</b>🔸\n\n`
            copy.forEach(st => {
              if (localChannels.channels[channelID].type === 'archive') newText += `<a href="https://t.me/c/${channelID.toString().split('-100')[1]}/${st.messageID}">${st.name} - ${st.release}</a>\n`
              if (localChannels.channels[channelID].type === 'collection') newText += `<a href="https://t.me/c/${channelID.toString().split('-100')[1]}/${st.messageID}">${st.release}</a>\n`
            });
          }

          try {
            telegram.editMessageText(channelID, localChannels.channels[channelID].indexers[0].messageID, undefined, newText, {
              parse_mode: "HTML"
            })
          } catch (e) {
            console.log(e)
          }

        }
      } else {
        const numberOfIndexer = localChannels.channels[channelID].indexers.length + 1;
        const defaultText = `🔸 <b>Индексатор ${numberOfIndexer}</b>🔸\n\n<i>Скоро тут будут ссылки на релизы!</i>`;
        localChannels.channels[channelID].indexers.push({
          messageID: ctx.channelPost.message_id
        })
        await telegram.editMessageText(channelID, ctx.channelPost.message_id, undefined, defaultText, {
          parse_mode: "HTML"
        })
        await telegram.pinChatMessage(channelID, ctx.channelPost.message_id);
      }

      sessionInstance.saveSession('channelsSession', localChannels);
    }
  }
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