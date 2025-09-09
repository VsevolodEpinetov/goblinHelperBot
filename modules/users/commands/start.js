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
  
  // Try to delete the command message (non-critical)
  try {
    await ctx.deleteMessage();
  } catch (deleteError) {
    // Ignore delete errors - they're not critical
  }

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
    try {
      if (!IS_CLOSED) {
        // Use the new comprehensive menu system for new users
        const menu = await getUserMenu(ctx, userData);
        await ctx.replyWithHTML(menu.message, {
          ...Markup.inlineKeyboard(menu.keyboard)
        });
        console.log(`✅ /start new user response sent to ${userId} (@${username})`);
      } else {
        await ctx.reply(t('start.closed'));
        console.log(`✅ /start closed response sent to ${userId} (@${username})`);
      }
    } catch (error) {
      console.error(`❌ /start new user failed for ${userId} (@${username}):`, error.message);
      try {
        await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
      } catch (fallbackError) {
        console.error('❌ New user fallback failed:', fallbackError.message);
      }
    }
    return;
  }
  
  // Use the new comprehensive menu system for existing users
  try {
    console.log(`🔄 Generating menu for ${userId} (@${username})...`);
    const menu = await getUserMenu(ctx, userData);
    
    if (!menu || !menu.message) {
      throw new Error('Menu generation returned invalid data');
    }
    
    // Validate message content
    if (menu.message.length > 4096) {
      console.error(`❌ Message too long: ${menu.message.length} characters`);
      throw new Error('Message too long for Telegram');
    }
    
    // Validate keyboard
    if (!Array.isArray(menu.keyboard)) {
      console.error('❌ Invalid keyboard format');
      throw new Error('Invalid keyboard format');
    }
    
    console.log(`🔄 Sending response to ${userId} (@${username})...`);
    
    // Show the appropriate menu based on user state
    await ctx.replyWithHTML(menu.message, {
      ...Markup.inlineKeyboard(menu.keyboard)
    });
    
    console.log(`✅ /start response sent to ${userId} (@${username})`);
    
  } catch (error) {
    console.error(`❌ /start failed for ${userId} (@${username}):`, error.message);
    console.error('Full error:', error);
    
    // Send a simple fallback response
    try {
      await ctx.reply(`❌ Произошла ошибка при загрузке меню.\n\nОбратитесь к администратору: ${error.message}`);
      console.log(`✅ Fallback response sent to ${userId} (@${username})`);
    } catch (fallbackError) {
      console.error('❌ Even fallback response failed:', fallbackError.message);
    }
  }
});

// Test: Add a simple command to see if commands work at all
const testCommand = Composer.command('test', async (ctx) => {
  console.log(`🧪 /test: User ${ctx.from.id} (@${ctx.from.username || 'no_username'})`);
  await ctx.reply('Test command works!');
});

const combinedCommands = Composer.compose([startCommand, testCommand]);

module.exports = combinedCommands;