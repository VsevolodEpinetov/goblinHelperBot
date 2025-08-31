//#region imports
const { Telegraf, Scenes, session } = require('telegraf');
require('dotenv').config();

console.log('🚀 Starting bot initialization...');
console.log('📋 Environment check:');
console.log('  - TOKEN exists:', !!process.env.TOKEN);
console.log('  - TOKEN length:', process.env.TOKEN ? process.env.TOKEN.length : 0);
console.log('  - Database config exists:', !!process.env.PGHOST);

const bot = new Telegraf(process.env.TOKEN)
const SETTINGS = require('./settings.json')
const path = require('path');
const { t } = require('./modules/i18n');

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
  SESSIONS.POLLS_SESSION
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

// Ignore banned users
console.log('🔧 Loading banned middleware...');
bot.use(require('./modules/middleware/banned'))

// Track user interactions and update user data
console.log('🔧 Loading userTracker middleware...');
bot.use(require('./modules/middleware/userTracker'))

console.log('🔧 Loading modules...');
bot.use(require('./modules/lots'))
bot.use(require('./modules/polls'))
bot.use(require('./modules/indexator-creator'))
bot.use(require('./modules/payments'))
bot.use(require('./modules/admin'))
// Admin helper actions for invite links
bot.use(require('./modules/admin/actions/users/inviteLinksMenu'))
bot.use(require('./modules/users'))
bot.use(require('./modules/common'))
//#endregion

// Handle user profile updates
bot.on('message', async (ctx) => {
  console.log('📨 Received message:', {
    from: ctx.from?.id,
    username: ctx.from?.username,
    text: ctx.message?.text?.substring(0, 50),
    chatType: ctx.chat?.type,
    chatId: ctx.chat?.id
  });
  // This will be handled by the userTracker middleware
  // but we can add specific logic here if needed
});

// Add a catch-all handler for any updates
bot.on('text', async (ctx) => {
  console.log('📝 Text message received:', ctx.message.text);
});

bot.on('callback_query', async (ctx) => {
  console.log('🔘 Callback query received:', ctx.callbackQuery.data);
});

bot.on('edited_message', async (ctx) => {
  // This will be handled by the userTracker middleware
  // but we can add specific logic here if needed
});

// Handle user profile updates and chat member updates
bot.on('my_chat_member', async (ctx) => {
  // This will be handled by the userTracker middleware
  // but we can add specific logic here if needed
});

// Handle callback queries (button clicks, etc.)
bot.on('callback_query', async (ctx) => {
  // This will be handled by the userTracker middleware
  // but we can add specific logic here if needed
});

// Handle inline queries
bot.on('inline_query', async (ctx) => {
  // This will be handled by the userTracker middleware
  // but we can add specific logic here if needed
});

bot.on('chat_join_request', async ctx => {
  const { getUser, findMonthByChatId, hasUserPurchasedMonth, incrementMonthCounter, getMonthChatId } = require('./modules/db/helpers');
  
  const userInfo = await getUser(ctx.from.id);
  if (!userInfo) {
    return;
  }

  if (userInfo.roles.indexOf('rejected') > -1) {
    return;
  }

  // Find which month this chat belongs to
  const monthData = await findMonthByChatId(ctx.chat.id);
  if (!monthData) {
    ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, `Не смог найти группу`)
    return;
  }

  const { year, month, type } = monthData;

  const monthPurchased = await hasUserPurchasedMonth(ctx.from.id, year, month, type);
  const adminRole = type == 'plus' ? 'adminPlus' : 'admin';
  const isAppropriateAdmin = userInfo.roles.indexOf(adminRole) > -1;

  // TODO: check bot's administrator rights

  if (monthPurchased || isAppropriateAdmin) {
    await ctx.approveChatJoinRequest(ctx.from.id);
    await incrementMonthCounter(year, month, type, 'joined');
    // Mark last unused invitation link as used
    try {
      const knex = require('./modules/db/knex');
      const sub = knex('invitationLinks')
        .select('id')
        .where({ userId: ctx.from.id, groupPeriod: `${year}_${month}`, groupType: type })
        .whereNull('usedAt')
        .orderBy('createdAt', 'desc')
        .limit(1);
      await knex('invitationLinks')
        .where('id', '=', sub)
        .update({ usedAt: knex.fn.now() });
    } catch (e) {
      console.log('Failed to mark invite as used', e);
    }
    await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `🟢 Added ${userInfo.username != 'not_set' ? `@${userInfo.username}` : `${userInfo.first_name}`} (${ctx.from.id}) to the ${year}_${month}_${type}`)
    if (isAppropriateAdmin) {
      await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `⚠️ Promoted ${userInfo.username != 'not_set' ? `@${userInfo.username}` : `${userInfo.first_name}`} (${ctx.from.id}) in the ${year}_${month}_${type}`)
      const chatId = await getMonthChatId(year, month, type);
      if (type == 'regular') {
        await ctx.telegram.promoteChatMember(chatId, userInfo.id, {
          can_delete_messages: true,
          can_edit_messages: true,
          can_post_messages: true,
          can_pin_messages: true
        })
      }
      if (type == 'plus') {
        await ctx.telegram.promoteChatMember(chatId, userInfo.id, {
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
  console.log('❌ Bot error caught:', error);
  console.log('❌ Error stack:', error.stack);
})

// --------------------------------------------------------------------------
// 4. Service
// --------------------------------------------------------------------------
console.log('🚀 Launching bot...');
bot.launch({ dropPendingUpdates: true })
  .then(() => {
    console.log('✅ Bot launched successfully!');
    console.log('🤖 Bot info:', bot.botInfo);
  })
  .catch((error) => {
    console.log('❌ Failed to launch bot:', error);
  });

// Enable graceful stop
process.once('SIGINT', () => {
  console.log('🛑 Received SIGINT, stopping bot...');
  bot.stop('SIGINT')
})
process.once('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, stopping bot...');
  bot.stop('SIGTERM')
})