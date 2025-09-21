const { Markup } = require("telegraf");
const knex = require('../../db/knex');
const { getUserSubscriptionStatus, getSubscriptionStatusMessage } = require('../subscriptionHelpers');

/**
 * Main user menu for users who are already in the group
 */
async function getMainUserMenu(ctx, userData) {
  const roles = userData.roles || [];
  const isAdmin = roles.includes('admin') || roles.includes('adminPlus');
  const isProtector = roles.includes('protector');
  
  // Get subscription status with error handling
  let subscriptionStatus;
  let statusMessage;
  try {
    subscriptionStatus = await getUserSubscriptionStatus(userData.id);
    statusMessage = getSubscriptionStatusMessage(subscriptionStatus);
  } catch (statusError) {
    console.error('❌ Subscription status error:', statusError.message);
    subscriptionStatus = { status: 'unpaid' };
    statusMessage = '❌ Статус подписки недоступен';
  }
  
  let message = '';
  message += `👋 <b>Главное меню логова</b>\n\n`;
  message += `Добро пожаловать в заловни. Выбирай, куда сунуть нос — `
          + `но помни: законы древни, а казна ненасытна.\n\n`;
  
  message += `📅 <b>Твой доступ</b>\n${statusMessage}\n\n`;

  // RPG status (loyalty) with robust error handling
  try {
    const lvl = await knex('user_levels').where({ user_id: Number(userData.id) }).first();
    if (lvl) {
      try {
        const benefitsByTier = require('../../../configs/benefits');
        const perks = benefitsByTier[lvl.current_tier] || [];
        const tier = String(lvl.current_tier || 'wood').toUpperCase();
        const level = lvl.current_level || 1;
        const xp = lvl.total_xp || 0;
        const xpToNext = lvl.xp_to_next_level;

        message += `🏅 <b>Ранг:</b> ${tier} ${level}\n`;
        message += `✨ <b>Опыт:</b> ${xp}` + (xpToNext != null ? ` (до следующего: ${xpToNext})` : ``) + `\n`;
        if (perks.length) {
          message += `🗝 <b>Доступы:</b> ${perks.join(', ')}\n\n`;
        } else {
          message += `\n`;
        }
      } catch (benefitsError) {
        console.error('❌ Benefits config error:', benefitsError.message);
        message += `🏅 <b>Ранг:</b> ${String(lvl.current_tier || 'wood').toUpperCase()} ${lvl.current_level || 1}\n\n`;
      }
    } else {
      // User has no XP record - this is fine for existing users
      message += `🏅 <b>Ранг:</b> загружается…\n\n`;
    }
  } catch (xpError) {
    console.error('❌ XP lookup error (non-fatal):', xpError.message);
    message += `\n`;
  }
  
  const keyboard = [];
  
  // Payment / upgrade actions by status
  if (subscriptionStatus.status === 'unpaid') {
    keyboard.push([
      Markup.button.callback('💳 Внести взнос за месяц', 'payCurrentMonth')
    ]);
  } else if (subscriptionStatus.status === 'paid_regular') {
    keyboard.push([
      Markup.button.callback('📁 Открыть архив', 'joinArchive'),
      Markup.button.callback('⬆️ Обновить до Расширенного', 'upgradeToPlus')
    ]);
  } else {
    keyboard.push([
      Markup.button.callback('📁 Открыть архив', 'joinArchive')
    ]);
  }
  
  // Primary actions
  keyboard.push([
    Markup.button.callback('📊 Мой профиль', 'userProfile'),
    Markup.button.callback('📜 Мои свитки', 'userScrolls')
  ]);
  
  // Secondary actions
  keyboard.push([
    Markup.button.callback('⚔️ Рейды', 'userRaids'),
    Markup.button.callback('😈 Сделки с демонами', 'userKickstarters')
  ]);

  // Old months access
  keyboard.push([
    Markup.button.callback('📦 Архивные месяцы', 'oldMonthsMenu')
  ]);
  
  // Admin actions (if applicable)
  if (isAdmin) {
    keyboard.push([
      Markup.button.callback('⚙️ Панель старейшин', 'adminMenu')
    ]);
  }
  
  // Protector actions (request management)
  if (isProtector) {
    keyboard.push([
      Markup.button.callback('📋 Заявки на вступление', 'adminPendingApplications'),
      Markup.button.callback('🔍 Поиск заявки', 'searchRequest')
    ]);
  }
  
  // Utility actions
  keyboard.push([
    Markup.button.callback('❓ Гоблинская помощь', 'userHelp'),
    Markup.button.callback('🔄 Обновить статус', 'refreshUserStatus')
  ]);
  
  return {
    message,
    keyboard
  };
}

module.exports = { getMainUserMenu };
