const { Composer, Markup } = require('telegraf');
const util = require('../../util');
const { t } = require('../../../modules/i18n');
const SETTINGS = require('../../../settings.json');
const { getUser, getAllUsers } = require('../../db/helpers');
const { getUserMenu, createInvitationLink } = require('../menuSystem');
const knex = require('../../db/knex');

console.log('🔧 Loading start command handler...');

// Команда /start
const startCommand = Composer.command('start', async (ctx) => {
  console.log('🎯 START command received!');
  console.log('🎯 START command context:', {
    message: ctx.message?.text,
    from: ctx.from?.id,
    chat: ctx.chat?.id
  });
  console.log('👤 User:', {
    id: ctx.message?.from?.id,
    username: ctx.message?.from?.username,
    firstName: ctx.message?.from?.first_name
  });
  console.log('💬 Chat:', {
    id: ctx.message?.chat?.id,
    type: ctx.message?.chat?.type
  });
  
  util.log(ctx);

  if (ctx.message.chat.id < 0) {
    await ctx.replyWithHTML(t('start.chatOnlyPrivate'))
    return;
  }

  const userId = ctx.message.from.id;
  // Require Telegram username
  if (!ctx.message.from.username || String(ctx.message.from.username).trim() === '') {
    await ctx.replyWithHTML(t('messages.username_required'));
    return;
  }
  ctx.deleteMessage()

  const IS_CLOSED = false; //TODO: move to settings

  // Get user data from database
  console.log('🔍 Fetching user data for ID:', userId);
  const userData = await getUser(userId);
  console.log('📊 User data:', userData ? {
    id: userData.id,
    username: userData.username,
    roles: userData.roles,
    hasPurchases: !!userData.purchases
  } : 'null');

  console.log('🎭 Role analysis:');
  console.log('  - User roles:', userData?.roles || []);
  console.log('  - Expected roles for super user: [super]');
  console.log('  - Expected roles for goblin/admin: [goblin, admin, adminPlus]');

  // Special handling for new users (no userData)
  if (!userData) {
    if (!IS_CLOSED) {
      // Use the new comprehensive menu system for new users
      const menu = await getUserMenu(ctx, userData);
      await ctx.replyWithHTML(menu.message, {
        ...Markup.inlineKeyboard(menu.keyboard)
      });
    } else {
      await ctx.reply(t('start.closed'))
    }
    return;
  }
  
  // Use the new comprehensive menu system for existing users
  const menu = await getUserMenu(ctx, userData);
  
  // Show the appropriate menu based on user state
  await ctx.replyWithHTML(menu.message, {
    ...Markup.inlineKeyboard(menu.keyboard)
  });
});

console.log('🔧 Start command handler created:', !!startCommand);

// Test: Add a simple command to see if commands work at all
const testCommand = Composer.command('test', async (ctx) => {
  console.log('🧪 TEST command received!');
  await ctx.reply('Test command works!');
});

const combinedCommands = Composer.compose([startCommand, testCommand]);
console.log('🔧 Combined commands created:', !!combinedCommands);

module.exports = combinedCommands;