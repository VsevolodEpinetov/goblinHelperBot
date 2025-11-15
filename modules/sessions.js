let GLOBAL_SESSION, USER_SESSION, CHAT_SESSION, POLLS_SESSION;

const useRedis = process.env.USE_REDIS_SESSIONS !== 'false';

if (useRedis) {
  const RedisSession = require('telegraf-session-redis-upd')

  const globalSession = new RedisSession({
    property: 'globalSession',
    getSessionKey: () => { return "global" }
  })

  // Lots session removed - replaced with raids

  // months, settings, users, kickstarters sessions removed - now using PostgreSQL

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
  USER_SESSION = userSession;
  CHAT_SESSION = chatSession;
  POLLS_SESSION = polls;
} else {
  function memorySession(property) {
    return async (ctx, next) => {
      if (!ctx[property]) ctx[property] = {};
      await next();
    };
  }

  GLOBAL_SESSION = memorySession('globalSession');
  USER_SESSION = memorySession('userSession');
  CHAT_SESSION = memorySession('chatSession');
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
  USER_SESSION: USER_SESSION,
  CHAT_SESSION: CHAT_SESSION,
  POLLS_SESSION: POLLS_SESSION
  // USERS_SESSION, MONTHS_SESSION, KICKSTARTERS_SESSION, SETTINGS_SESSION, LOTS_SESSION
  // have been removed - now using PostgreSQL directly via helper functions
  //UNIQUE_SESSION: session
};