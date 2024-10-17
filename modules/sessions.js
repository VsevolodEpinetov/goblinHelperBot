const RedisSession = require('telegraf-session-redis-upd')

const globalSession = new RedisSession({
  property: 'globalSession',
  getSessionKey: () => { return "global" }
})

const lots = new RedisSession({
  property: 'lots',
  getSessionKey: () => { return "lots" }
})

const months = new RedisSession({
  property: 'months',
  getSessionKey: () => { return "months" }
})

const settings = new RedisSession({
  property: 'settings',
  getSessionKey: () => { return "settings" }
})

const users = new RedisSession({
  property: 'users',
  getSessionKey: () => { return "users" }
})

const kickstarters = new RedisSession({
  property: 'kickstarters',
  getSessionKey: () => { return "kickstarters" }
})

const channelsSession = new RedisSession({
  property: 'channelsSession',
  getSessionKey: () => { return "channels" }
})

const userSession = new RedisSession({
  property: 'userSession',
  getSessionKey: (ctx) => { if (ctx.from) return `${ctx.from.id}-user` }
})

const chatSession = new RedisSession({
  property: 'chatSession',
  getSessionKey: (ctx) => { if (ctx.chat) return `${ctx.chat.id}-chat` }
})

/*const session = new RedisSession({
  getSessionKey: (ctx) => {
    if (!ctx.chat && !ctx.from) {
      return
    }
    return `${ctx.from.id}:${ctx.chat.id}`
  }
})*/

module.exports = {
  GLOBAL_SESSION: globalSession,
  CHANNELS_SESSION: channelsSession,
  USER_SESSION: userSession,
  CHAT_SESSION: chatSession,
  USERS_SESSION: users,
  LOTS_SESSION: lots,
  MONTHS_SESSION: months,
  KICKSTARTERS_SESSION: kickstarters,
  SETTINGS_SESSION: settings
  //UNIQUE_SESSION: session
};