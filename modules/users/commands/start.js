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
  
  // User interaction logged by cleanLogger middleware

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
  
  // User data processing

  // Special handling for new users (no userData)
  if (!userData) {
    try {
      if (!IS_CLOSED) {
        // Use the new comprehensive menu system for new users
        const menu = await getUserMenu(ctx, userData);
        await ctx.replyWithHTML(menu.message, {
          ...Markup.inlineKeyboard(menu.keyboard)
        });
        // New user response sent
      } else {
        await ctx.reply(t('start.closed'));
        // Closed response sent
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
    const menu = await getUserMenu(ctx, userData);
    
    if (!menu || !menu.message) {
      throw new Error('Menu generation returned invalid data');
    }
    
    // Validate message content
    if (menu.message.length > 4096) {
      throw new Error('Message too long for Telegram');
    }
    
    // Validate keyboard
    if (!Array.isArray(menu.keyboard)) {
      throw new Error('Invalid keyboard format');
    }
    
    // Show the appropriate menu based on user state
    await ctx.replyWithHTML(menu.message, {
      ...Markup.inlineKeyboard(menu.keyboard)
    });
    
  } catch (error) {
    console.error(`❌ /start failed for ${userId} (@${username}):`, error.message);
    
    // Send a simple fallback response
    try {
      await ctx.reply(`❌ Произошла ошибка при загрузке меню.\n\nОбратитесь к администратору: ${error.message}`);
    } catch (fallbackError) {
      console.error('❌ Even fallback response failed:', fallbackError.message);
    }
  }
});

// Test command
const testCommand = Composer.command('test', async (ctx) => {
  await ctx.reply('Test command works!');
});

const combinedCommands = Composer.compose([startCommand, testCommand]);

module.exports = combinedCommands;