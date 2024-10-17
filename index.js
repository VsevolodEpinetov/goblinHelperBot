//#region imports
const { Telegraf, Scenes, session } = require('telegraf');
require('dotenv').config();
const bot = new Telegraf(process.env.TOKEN)
const SETTINGS = require('./settings.json')
const path = require('path');

const util = require('./modules/util.js');
//#endregion

//#region Redis
// --------------------------------------------------------------------------
// 1. Redis, sessions
// --------------------------------------------------------------------------
const RedisSession = require('telegraf-session-redis-upd')
const sessionInstance = new RedisSession();
const SESSIONS = require('./modules/sessions.js');
bot.use(
  SESSIONS.GLOBAL_SESSION,
  SESSIONS.CHANNELS_SESSION,
  SESSIONS.USER_SESSION,
  SESSIONS.CHAT_SESSION,
  SESSIONS.LOTS_SESSION,
  SESSIONS.USERS_SESSION,
  SESSIONS.MONTHS_SESSION,
  SESSIONS.KICKSTARTERS_SESSION,
  SESSIONS.SETTINGS_SESSION
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

const lotsScenes = util.getAllFilesFromFolder(path.join(__dirname, './modules/lots/scenes'))
  .map(file => require(file));

const adminScenes = util.getAllFilesFromFolder(path.join(__dirname, './modules/admin/scenes'))
  .map(file => require(file));

const usersScenes = util.getAllFilesFromFolder(path.join(__dirname, './modules/users/scenes'))
  .map(file => require(file));

//#region Register Scenes, Init Stage
const stage = new Scenes.Stage([
  ...lotsScenes,
  ...adminScenes,
  ...usersScenes
]);
bot.use(session());
bot.use(stage.middleware());

bot.use(require('./modules/lots'))
bot.use(require('./modules/polls'))
bot.use(require('./modules/indexator-creator'))
bot.use(require('./modules/payments'))
bot.use(require('./modules/admin'))
bot.use(require('./modules/users'))
bot.use(require('./modules/common'))
//#endregion

bot.on('chat_join_request', async ctx => {
  if (!ctx.users.list[ctx.from.id]) {
    return;
  }

  const userInfo = ctx.users.list[ctx.from.id];

  if (userInfo.roles.indexOf('rejected') > -1) {
    return;
  }

  let month;
  let year;
  let type = 'regular';

  for (const yearRaw in ctx.months.list) {
    for (const monthRaw in ctx.months.list[yearRaw]) {
      if (ctx.months.list[yearRaw][monthRaw].regular.id == ctx.chat.id) {
        year = yearRaw;
        month = monthRaw;
      }
      if (ctx.months.list[yearRaw][monthRaw].plus.id == ctx.chat.id) {
        year = yearRaw;
        month = monthRaw;
        type = 'plus';
      }
    }
  }

  if (!month) {
    ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, `Не смог найти группу`)
  }

  const monthPurchased = userInfo.purchases.groups[type].indexOf(`${year}_${month}`) > -1;
  const adminRole = type == 'plus' ? 'adminPlus' : 'admin';
  const isAppropriateAdmin = userInfo.roles.indexOf(adminRole) > -1;

  // TODO: check bot's administrator rights

  if (monthPurchased || isAppropriateAdmin) {
    await ctx.approveChatJoinRequest(ctx.from.id);
    ctx.months.list[year][month][type].counter.joined = ctx.months.list[year][month][type].counter.joined + 1;
    await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `🟢 Added ${userInfo.username != 'not_set' ? `@${userInfo.username}` : `${userInfo.first_name}`} (${ctx.from.id}) to the ${year}_${month}_${type}`)
    if (isAppropriateAdmin) {
      await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `⚠️ Promoted ${userInfo.username != 'not_set' ? `@${userInfo.username}` : `${userInfo.first_name}`} (${ctx.from.id}) in the ${year}_${month}_${type}`)
      if (type == 'regular') {
        await ctx.telegram.promoteChatMember(ctx.months.list[year][month][type].id, userInfo.id, {
          can_delete_messages: true,
          can_edit_messages: true,
          can_post_messages: true,
          can_pin_messages: true
        })
      }
      if (type == 'plus') {
        await ctx.telegram.promoteChatMember(ctx.months.list[year][month][type].id, userInfo.id, {
          can_delete_messages: true,
          can_edit_messages: true,
          can_post_messages: true,
          can_pin_messages: true,
          is_anonymous: true,
          can_manage_topics: true
        })
      }
    }
  } else {
    await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `🆘 ${userInfo.username != 'not_set' ? `@${userInfo.username}` : `${userInfo.first_name}`} (${ctx.from.id}) applied to the ${year}_${month}_${type} but was rejected`)
  }
})

bot.hears(/^[яЯ]\s*оплатил(!)*$/g, async (ctx) => {
  if (ctx.message.chat.id < 0) return;
  ctx.reply(`Это старый формат, я уже работаю в новом. Пожалуйста, используй /start и работай через меню 🤗`)
})

bot.command('ex', ctx => {
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) {
    return;
  }
  ctx.deleteMessage();
  eval(ctx.message.text.split('/ex ')[1]);
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