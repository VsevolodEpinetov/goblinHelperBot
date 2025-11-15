//#region imports
const { Telegraf, Scenes, session } = require('telegraf');
require('dotenv').config();

// Bot starting...

const bot = new Telegraf(process.env.TOKEN)
const SETTINGS = require('./settings.json')
const path = require('path');
const util = require('./modules/util.js');
//#endregion

//#region Sessions
// --------------------------------------------------------------------------
// 1. Sessions (Redis for temporary data, PostgreSQL for persistent data)
// --------------------------------------------------------------------------
const RedisSession = require('telegraf-session-redis-upd')
const sessionInstance = new RedisSession();
const SESSIONS = require('./modules/sessions.js');
bot.use(
  SESSIONS.GLOBAL_SESSION,
  SESSIONS.USER_SESSION,
  SESSIONS.CHAT_SESSION,
  SESSIONS.POLLS_SESSION
)
//#endregion

//#region Scenes
// --------------------------------------------------------------------------
// 2. Scenes (for multi-step interactions)
// --------------------------------------------------------------------------

const adminScenes = util.getAllFilesFromFolder(path.join(__dirname, './modules/admin/scenes'))
  .map(file => require(file));

const usersScenes = util.getAllFilesFromFolder(path.join(__dirname, './modules/users/scenes'))
  .map(file => require(file));

const raidsScenes = util.getAllFilesFromFolder(path.join(__dirname, './modules/raids/scenes'))
  .map(file => require(file));

const stage = new Scenes.Stage([
  ...adminScenes,
  ...usersScenes,
  ...raidsScenes
]);
bot.use(session());
bot.use(stage.middleware());
//#endregion

// --------------------------------------------------------------------------
// 3. Middleware (in order of execution)
// --------------------------------------------------------------------------

bot.use(require('./modules/middleware/cleanLogger'));
bot.use(require('./modules/middleware/banned'));
bot.use(require('./modules/middleware/userTracker'));


// --------------------------------------------------------------------------
// 4. Modules (command and action handlers)
// --------------------------------------------------------------------------

bot.use(require('./modules/polls'));

bot.use(require('./modules/common'));

bot.use(require('./modules/admin'));
bot.use(require('./modules/users'));
// Promo functionality is integrated into admin and users modules

bot.use(require('./modules/payments'));
bot.use(require('./modules/raids'));

// Import payment handlers
const { handlePreCheckoutQuery } = require('./modules/payments/preCheckoutQuery');
const { handleSuccessfulPayment } = require('./modules/payments/successfulPayment');

// --------------------------------------------------------------------------
// 5. Special handlers (not part of modules)
// --------------------------------------------------------------------------

// Chat join request handler
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
    ctx.telegram.sendMessage(SETTINGS.CHATS.GLAVGOBLIN, `Не смог найти группу`)
    return;
  }

  const { year, month, type } = monthData;

  const monthPurchased = await hasUserPurchasedMonth(ctx.from.id, year, month, type);
  const adminRole = type == 'plus' ? 'adminPlus' : 'admin';
  const isAppropriateAdmin = userInfo.roles.indexOf(adminRole) > -1;

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
});

// Admin eval command
bot.command('ex', ctx => {
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV && ctx.message.from.id != SETTINGS.CHATS.GLAVGOBLIN) {
    return;
  }
  ctx.deleteMessage();
  eval(ctx.message.text.split('/ex ')[1]);
});


// Pre-checkout query handler (required for Telegram Stars)
bot.on('pre_checkout_query', handlePreCheckoutQuery);

// Payment success handler
bot.on('successful_payment', handleSuccessfulPayment);

// Fallback: some clients deliver successful payment as a message event
bot.on('message', async (ctx) => {
  try {
    const sp = ctx.message?.successful_payment;
    if (!sp) return;
    console.log('💰 Fallback handler: Payment received (message):', sp);
    const payload = JSON.parse(sp.invoice_payload);
    console.log('💰 Fallback payload type:', payload.type);
    if (payload.type === 'subscription') {
      const { processSubscriptionPayment } = require('./modules/payments/subscriptionPaymentService');
      const result = await processSubscriptionPayment(ctx, sp);
      if (!result.success) console.error('❌ Fallback: subscription processing failed:', result.error);
      return;
    }
    if (payload.type === 'old_month') {
      const { processOldMonthPayment } = require('./modules/payments/oldMonthPaymentService');
      const result = await processOldMonthPayment(ctx, sp);
      if (!result.success) console.error('❌ Fallback: old month processing failed:', result.error);
      return;
    }
  } catch (e) {
    console.error('❌ Fallback payment handler error:', e);
  }
});
//#endregion

//#region Error Handling
// --------------------------------------------------------------------------
// 6. Error handling
// --------------------------------------------------------------------------
bot.catch((error, ctx) => {
  console.log('❌ Bot error caught:', error);
  console.log('❌ Error stack:', error.stack);
  console.log('❌ Error context:', {
    updateType: Object.keys(ctx.update).filter(key => key !== 'update_id')[0],
    userId: ctx.from?.id,
    chatId: ctx.chat?.id,
    messageText: ctx.message?.text
  });
  
  // Try to send error message to user if possible
  if (ctx.reply) {
  }
});
//#endregion

//#region Launch
// --------------------------------------------------------------------------
// 7. Bot launch
// --------------------------------------------------------------------------
bot.launch({ dropPendingUpdates: true })
  .then(() => {
    console.log(`✅ Bot online: @${bot.botInfo.username}`);
    // Make bot available globally for scrolls notifications and other utilities
    globalThis.__bot = bot;
  })
  .catch((error) => {
    console.log('❌ Failed to launch bot:', error);
  });

// Enable graceful stop
process.once('SIGINT', () => {
  bot.stop('SIGINT')
})
process.once('SIGTERM', () => {
  bot.stop('SIGTERM')
})
//#endregion