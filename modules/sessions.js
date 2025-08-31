let GLOBAL_SESSION, CHANNELS_SESSION, USER_SESSION, CHAT_SESSION, USERS_SESSION, LOTS_SESSION, MONTHS_SESSION, KICKSTARTERS_SESSION, SETTINGS_SESSION, POLLS_SESSION;

const useRedis = process.env.USE_REDIS_SESSIONS !== 'false';

if (useRedis) {
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

  const polls = new RedisSession({
    property: 'polls',
    getSessionKey: () => { return "polls" }
  })

  const userSession = new RedisSession({
    property: 'userSession',
    getSessionKey: (ctx) => { if (ctx.from) return `${ctx.from.id}-user` }
  })

  const chatSession = new RedisSession({
    property: 'chatSession',
    getSessionKey: (ctx) => { if (ctx.chat) return `${ctx.chat.id}-chat` }
  })

  GLOBAL_SESSION = globalSession;
  CHANNELS_SESSION = channelsSession;
  USER_SESSION = userSession;
  CHAT_SESSION = chatSession;
  USERS_SESSION = users;
  LOTS_SESSION = lots;
  MONTHS_SESSION = months;
  KICKSTARTERS_SESSION = kickstarters;
  SETTINGS_SESSION = settings;
  POLLS_SESSION = polls;
} else {
  function memorySession(property) {
    return async (ctx, next) => {
      if (!ctx[property]) ctx[property] = {};
      await next();
    };
  }

  GLOBAL_SESSION = memorySession('globalSession');
  CHANNELS_SESSION = memorySession('channelsSession');
  USER_SESSION = memorySession('userSession');
  CHAT_SESSION = memorySession('chatSession');
  USERS_SESSION = memorySession('users');
  LOTS_SESSION = memorySession('lots');
  MONTHS_SESSION = memorySession('months');
  KICKSTARTERS_SESSION = memorySession('kickstarters');
  SETTINGS_SESSION = memorySession('settings');
  POLLS_SESSION = memorySession('polls');
}

/*const session = new RedisSession({
  getSessionKey: (ctx) => {
    if (!ctx.chat && !ctx.from) {
      return
    }
    return `${ctx.from.id}:${ctx.chat.id}`
  }
})*/

module.exports = {
  GLOBAL_SESSION: GLOBAL_SESSION,
  CHANNELS_SESSION: CHANNELS_SESSION,
  USER_SESSION: USER_SESSION,
  CHAT_SESSION: CHAT_SESSION,
  USERS_SESSION: USERS_SESSION,
  LOTS_SESSION: LOTS_SESSION,
  MONTHS_SESSION: MONTHS_SESSION,
  KICKSTARTERS_SESSION: KICKSTARTERS_SESSION,
  SETTINGS_SESSION: SETTINGS_SESSION,
  POLLS_SESSION: POLLS_SESSION
  //UNIQUE_SESSION: session
};