//#region imports
const { Telegraf, Scenes, session } = require('telegraf');
require('dotenv').config();

// Bot starting...

const bot = new Telegraf(process.env.TOKEN)
const SETTINGS = require('./settings.json')
const path = require('path');
const { t } = require('./modules/i18n');
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
  SESSIONS.CHANNELS_SESSION,
  SESSIONS.USER_SESSION,
  SESSIONS.CHAT_SESSION,
  SESSIONS.POLLS_SESSION
)
//#endregion

//#region Scenes
// --------------------------------------------------------------------------
// 2. Scenes (for multi-step interactions)
// --------------------------------------------------------------------------
// Lots system removed - replaced with raids

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

//#region Middleware
// --------------------------------------------------------------------------
// 3. Middleware (in order of execution)
// --------------------------------------------------------------------------
// Loading middleware

// 3.1. Clean logging middleware (first - logs user interactions only)
try {
  const cleanLogger = require('./modules/middleware/cleanLogger');
  bot.use(cleanLogger);
} catch (error) {
  console.error('❌ Failed to load logger middleware:', error);
}

// 3.2. Banned users middleware
bot.use(require('./modules/middleware/banned'));

// 3.3. User tracking middleware
bot.use(require('./modules/middleware/userTracker'));
//#endregion

//#region Modules
// --------------------------------------------------------------------------
// 4. Modules (command and action handlers)
// --------------------------------------------------------------------------
// Loading modules

// Temporarily commenting out other modules to test users module in isolation
// Lots module removed - replaced with raids

// bot.use(require('./modules/polls'));
// bot.use(require('./modules/indexator-creator'));

bot.use(require('./modules/payments'));
bot.use(require('./modules/common'));

try {
  bot.use(require('./modules/users'));
} catch (error) {
  console.error('❌ Error loading users module:', error);
}

bot.use(require('./modules/raids'));
bot.use(require('./modules/admin'));

// bot.use(require('./modules/admin/actions/users/inviteLinksMenu'));

//#endregion

//#region Special Handlers
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

// Legacy payment format handler
bot.hears(/^[яЯ]\s*оплатил(!)*$/g, async (ctx) => {
  if (ctx.message.chat.id < 0) return;
  ctx.reply(`Это старый формат, я уже работаю в новом. Пожалуйста, используй /start и работай через меню 🤗`)
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
bot.on('pre_checkout_query', async (ctx) => {
  try {
    console.log('💳 Pre-checkout query received:', ctx.preCheckoutQuery);
    
    const payload = JSON.parse(ctx.preCheckoutQuery.invoice_payload);
    
    if (payload.type === 'subscription') {
      const rpg = require('./configs/rpg');
      const expectedPrice = payload.subscriptionType === 'plus' ? 
        parseInt(rpg.prices.plusStars || process.env.PLUS_PRICE) : parseInt(rpg.prices.regularStars || process.env.REGULAR_PRICE);
      if (ctx.preCheckoutQuery.total_amount < expectedPrice) {
        console.error('Pre-checkout amount too low (subscription):', { expected: expectedPrice, received: ctx.preCheckoutQuery.total_amount, subscriptionType: payload.subscriptionType, currency: ctx.preCheckoutQuery.currency });
        await ctx.answerPreCheckoutQuery(false, 'Payment amount too low');
        return;
      }
      await ctx.answerPreCheckoutQuery(true);
    } else if (payload.type === 'old_month') {
      const rpg = require('./configs/rpg');
      const expectedPrice = parseInt((rpg.prices.regularStars || process.env.REGULAR_PRICE)) * 3;
      if (ctx.preCheckoutQuery.total_amount < expectedPrice) {
        console.error('Pre-checkout amount too low (old_month):', { expected: expectedPrice, received: ctx.preCheckoutQuery.total_amount, currency: ctx.preCheckoutQuery.currency });
        await ctx.answerPreCheckoutQuery(false, 'Payment amount too low');
        return;
      }
      await ctx.answerPreCheckoutQuery(true);
    } else {
      await ctx.answerPreCheckoutQuery(false, 'Invalid payment type');
      return;
    }
    const isTestMode = process.env.PAYMENT_TEST_MODE === 'true';
    console.log('✅ Pre-checkout query approved for user:', ctx.from.id);
    if (isTestMode) {
      console.log('🧪 Test mode - payment will be simulated');
    }
    
  } catch (error) {
    console.error('❌ Error processing pre-checkout query:', error);
    await ctx.answerPreCheckoutQuery(false, 'Payment processing error');
  }
});

// Payment success handler
bot.on('successful_payment', async (ctx) => {
  try {
    console.log('💰 Payment received:', ctx.message.successful_payment);
    
    const paymentData = ctx.message.successful_payment;
    const payload = JSON.parse(paymentData.invoice_payload);
    console.log('💰 Payment payload type:', payload.type);
    
    if (payload.type === 'subscription') {
      const { processSubscriptionPayment } = require('./modules/payments/subscriptionPaymentService');
      const { getUser } = require('./modules/db/helpers');
      const { getUserMenu } = require('./modules/users/menuSystem');
      const { Markup } = require('telegraf');
      const result = await processSubscriptionPayment(ctx, paymentData);
      if (!result.success) {
        console.error('❌ Payment processing failed:', result.error);
        await ctx.reply('❌ <b>Ошибка обработки платежа</b>\n\nПлатеж получен, но произошла ошибка при активации подписки.\nОбратись к администрации для решения проблемы.', { parse_mode: 'HTML' });
        return;
      }
      const userData = await getUser(ctx.from.id);
      if (!userData) {
        await ctx.reply('❌ <b>Ошибка обновления данных</b>\n\nПлатеж обработан, но не удалось обновить твой профиль.\nПопробуй обновить меню.', { parse_mode: 'HTML' });
        return;
      }
      const subscriptionType = result.subscriptionType === 'plus' ? '➕ Расширенная' : 'Обычная';
      const isTestMode = process.env.PAYMENT_TEST_MODE === 'true';
      const testModeText = isTestMode ? '\n\n🧪 <b>ТЕСТОВЫЙ РЕЖИМ</b> - Платеж был симулирован\n💡 <b>В тестовом режиме</b> - реальные деньги не списываются' : '';
      const successMessage = `🎉 <b>ПЛАТЕЖ УСПЕШНО ОБРАБОТАН!</b>\n\n✅ <b>Подписка активирована</b>\n🔹 <b>Тип:</b> ${subscriptionType}\n📅 <b>Период:</b> ${result.period}\n💰 <b>Сумма:</b> ${paymentData.total_amount} звёзд${testModeText}`;
      const menu = await getUserMenu(ctx, userData);
      await ctx.reply(successMessage, { parse_mode: 'HTML', ...Markup.inlineKeyboard(menu.keyboard) });
      return;
    }
    if (payload.type === 'old_month') {
      const { processOldMonthPayment } = require('./modules/payments/oldMonthPaymentService');
      const result = await processOldMonthPayment(ctx, paymentData);
      if (!result.success) {
        console.error('❌ Old month payment failed:', result.error);
        await ctx.reply('❌ Ошибка обработки покупки старого месяца');
      } else {
        await ctx.reply(`✅ Доступ к месяцу ${result.period} выдан`);
      }
      return;
    }
    
    
  } catch (error) {
    console.error('❌ Error processing payment success:', error);
    await ctx.reply(
      '❌ <b>Произошла ошибка</b>\n\n' +
      'Платеж получен, но произошла ошибка при обработке.\n' +
      'Обратись к администрации.',
      { parse_mode: 'HTML' }
    );
  }
});

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
    ctx.reply('Произошла ошибка. Попробуйте позже.').catch(e => 
      console.log('Failed to send error message to user:', e)
    );
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
    // expose bot for RPG notifications
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