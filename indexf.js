//#region imports
const { Telegraf, Markup, Telegram, Scenes, session } = require('telegraf');
require('dotenv').config();
const bot = new Telegraf(process.env.TOKEN)
const telegram = new Telegram(process.env.TOKEN)
const SETTINGS = require('./settings.json')
const STUDIOS = require('./studios.json')

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
  SESSIONS.USER_SESSION,
  SESSIONS.CHAT_SESSION
)
//#endregion

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