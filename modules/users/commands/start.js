const { Composer, Markup } = require('telegraf');
const util = require('../../util');
const { t } = require('../../../modules/i18n');
const SETTINGS = require('../../../settings.json');
const { getUser, getAllUsers } = require('../../db/helpers');
const { getUserMenu, createInvitationLink } = require('../menuSystem');
const knex = require('../../db/knex');

// Команда /start
const startCommand = Composer.command('start', async (ctx) => {
  const userId = ctx.message.from.id;
  const username = ctx.message.from.username;
  const firstName = ctx.message.from.first_name;
  
  console.log(`👤 /start: User ${userId} (@${username || 'no_username'}) ${firstName || 'Unknown'}`);
  
  util.log(ctx);

  if (ctx.message.chat.id < 0) {
    await ctx.replyWithHTML(t('start.chatOnlyPrivate'))
    return;
  }

  // Require Telegram username
  if (!username || String(username).trim() === '') {
    await ctx.replyWithHTML(t('messages.username_required'));
    return;
  }
  ctx.deleteMessage()

  const IS_CLOSED = false; //TODO: move to settings

  // Get user data from database
  const userData = await getUser(userId);
  
  // Log meaningful user stats
  if (userData) {
    console.log(`📊 User Stats: ${userId} (@${username}) - Roles: [${userData.roles.join(', ')}], Months: ${userData.purchases.groups.regular.length + userData.purchases.groups.plus.length}, Kickstarters: ${userData.purchases.kickstarters.length}`);
  } else {
    console.log(`🆕 New User: ${userId} (@${username}) ${firstName} - No existing data`);
  }

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

// Test: Add a simple command to see if commands work at all
const testCommand = Composer.command('test', async (ctx) => {
  console.log(`🧪 /test: User ${ctx.from.id} (@${ctx.from.username || 'no_username'})`);
  await ctx.reply('Test command works!');
});

const combinedCommands = Composer.compose([startCommand, testCommand]);

module.exports = combinedCommands;