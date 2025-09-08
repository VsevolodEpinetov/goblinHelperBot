const { Markup } = require("telegraf");
const knex = require('../db/knex');
const { getUser } = require('../db/helpers');
const { createInvitationLink, getUserInvitationLink } = require('../invitationService');
const { getUserSubscriptionStatus, getSubscriptionStatusMessage } = require('./subscriptionHelpers');
const SETTINGS = require('../../settings.json');

/**
 * Comprehensive User Menu System
 * Handles different user states and provides appropriate menus
 */

/**
 * Get user menu based on their current state
 */
async function getUserMenu(ctx, userData) {
  const userId = ctx.from.id;
  const roles = userData?.roles || [];
  
  console.log('🎭 getUserMenu called for user:', userId);
  console.log('🎭 userData:', userData ? { id: userData.id, roles: userData.roles } : 'null');
  console.log('🎭 roles:', roles);
  
  // Check if user is super user - show admin menu
  if (roles.includes('super')) {
    console.log('🎭 User is super, showing admin menu');
    return getSuperUserMenu(ctx, userData);
  }
  
  // Check if user is approved but hasn't joined the main group yet
  if (roles.includes('goblin') || roles.includes('admin') || roles.includes('adminPlus')) {
    console.log('🎭 User is approved, checking if joined group');
    return await getApprovedUserMenu(ctx, userData);
  }
  
  // Check if user is preapproved (needs interview)
  if (roles.includes('preapproved')) {
    return getPreapprovedUserMenu(ctx, userData);
  }
  
  // Check if user is pending
  if (roles.includes('pending')) {
    return getPendingUserMenu(ctx, userData);
  }
  
  // Check if user is rejected
  if (roles.includes('rejected')) {
    return getRejectedUserMenu(ctx, userData);
  }
  
  // Check if user is banned
  if (roles.includes('banned')) {
    return getBannedUserMenu(ctx, userData);
  }
  
  // Check if user is self-banned
  if (roles.includes('selfbanned')) {
    return getSelfBannedUserMenu(ctx, userData);
  }
  
  // Default case - new user
  return getNewUserMenu(ctx, userData);
}

/**
 * Menu for super users (admin interface)
 */
function getSuperUserMenu(ctx, userData) {
  return {
    message: `👑 <b>Админ панель</b>\n\n` +
            `Добро пожаловать в админ панель!\n\n` +
            `Выберите раздел для управления:`,
    keyboard: [
      [
        Markup.button.callback('Месяцы', 'adminMonths'),
        Markup.button.callback('Месяцы Плюс', 'adminMonthsPlus')
      ],
      [
        Markup.button.callback('Кикстартеры', 'adminKickstarters'),
        Markup.button.callback('Релизы', 'adminReleases')
      ],
      [
        Markup.button.callback('Люди', 'adminParticipants'),
        Markup.button.callback('Голосования', 'adminPolls'),
      ],
      [
        Markup.button.callback('📋 Управление заявками', 'adminAllApplications'),
        Markup.button.callback('🔍 Поиск пользователя', 'admin_search_user')
      ]
    ]
  };
}

/**
 * Menu for approved users (goblin, admin, adminPlus)
 * This is where the invitation link logic happens
 */
async function getApprovedUserMenu(ctx, userData) {
  const userId = ctx.from.id;
  
  console.log('🔍 getApprovedUserMenu called for user:', userId);
  
  // Check if user has already joined the group (has a used invitation link)
  const hasJoinedGroup = await checkIfUserJoinedGroup(userId);
  console.log('🔍 hasJoinedGroup:', hasJoinedGroup);
  
  if (hasJoinedGroup) {
    // User has already joined the group - show main menu
    console.log('🔍 User has joined group, showing main menu');
    return getMainUserMenu(ctx, userData);
  }
  
  // User hasn't joined yet - show invitation link
  const existingLinkResult = await getUserInvitationLink(userId);
  console.log('🔍 existingLinkResult:', existingLinkResult);
  
  if (existingLinkResult.success) {
    // User has an unused invitation link - show it
    return {
      message: `🎉 <b>Добро пожаловать в сообщество!</b>\n\n` +
              `Ты одобрен и можешь присоединиться к основной группе.\n\n` +
              `🔗 <b>Твоя персональная ссылка-приглашение:</b>\n` +
              `${existingLinkResult.inviteLink}\n\n` +
              `⚠️ <b>Важно:</b>\n` +
              `• Ссылка одноразовая - используй её только один раз\n` +
              `• После входа в группу ссылка станет недействительной\n` +
              `• Если потеряешь ссылку, обратись к администрации\n\n` +
              `Нажми кнопку ниже, когда присоединишься к группе:`,
      keyboard: [
        [Markup.button.callback('✅ Я присоединился к группе', 'confirmGroupJoin')],
        [Markup.button.callback('❓ Помощь', 'userHelp')]
      ]
    };
  } else {
    // User doesn't have an invitation link - create one and show it
    console.log('🔍 No existing link, creating new one...');
    const linkResult = await createInvitationLink(userId);
    console.log('🔍 linkResult:', linkResult);
    
    if (linkResult.success) {
      return {
        message: `🎉 <b>Добро пожаловать в сообщество!</b>\n\n` +
                `Ты одобрен и можешь присоединиться к основной группе.\n\n` +
                `🔗 <b>Твоя персональная ссылка-приглашение:</b>\n` +
                `${linkResult.inviteLink}\n\n` +
                `⚠️ <b>Важно:</b>\n` +
                `• Ссылка одноразовая - используй её только один раз\n` +
                `• После входа в группу ссылка станет недействительной\n` +
                `• Если потеряешь ссылку, обратись к администрации\n\n` +
                `Нажми кнопку ниже, когда присоединишься к группе:`,
        keyboard: [
          [Markup.button.callback('✅ Я присоединился к группе', 'confirmGroupJoin')],
          [Markup.button.callback('❓ Помощь', 'userHelp')]
        ]
      };
    } else {
      // If we can't create an invitation link, show main menu
      console.error(`❌ Failed to create invitation link for user ${userId}:`, linkResult.error);
      console.log('🔍 Falling back to main menu');
      return getMainUserMenu(ctx, userData);
    }
  }
}

/**
 * Main user menu for users who are already in the group
 */
async function getMainUserMenu(ctx, userData) {
  const roles = userData.roles || [];
  const isAdmin = roles.includes('admin') || roles.includes('adminPlus');
  
  // Get subscription status
  const subscriptionStatus = await getUserSubscriptionStatus(userData.id);
  const statusMessage = getSubscriptionStatusMessage(subscriptionStatus);
  
  let message = `👋 <b>Добро пожаловать в главное меню!</b>\n\n`;
  const { t } = require('../i18n');
  message += t('messages.main_intro') + `\n\n`;
  message += `📅 <b>Статус подписки:</b>\n${statusMessage}\n\n`;
  // RPG status (loyalty)
  try {
    const lvl = await knex('user_levels').where({ user_id: Number(userData.id) }).first();
    if (lvl) {
      const benefitsByTier = require('../../configs/benefits');
      const perks = benefitsByTier[lvl.current_tier] || [];
      message += `🏅 <b>RPG уровень:</b> ${lvl.current_tier.toUpperCase()} ${lvl.current_level}\n`;
      message += `✨ <b>XP:</b> ${lvl.total_xp}` + (lvl.xp_to_next_level != null ? ` (до след.: ${lvl.xp_to_next_level})` : '') + `\n`;
      if (perks.length) message += `🎁 <b>Бонусы:</b> ${perks.join(', ')}\n\n`;
      else message += `\n`;
    }
  } catch {}
  
  const keyboard = [];
  
  // Subscription actions based on payment status
  if (subscriptionStatus.status === 'unpaid') {
    // User hasn't paid - show pay button at the top
    keyboard.push([
      Markup.button.callback('💳 Оплатить месяц', 'payCurrentMonth')
    ]);
  } else {
    // User has paid - show archive button
    keyboard.push([
      Markup.button.callback('📁 Присоединиться к архиву', 'joinArchive')
    ]);
  }
  
  // Primary actions
  keyboard.push([
    Markup.button.callback('📊 Мой профиль', 'userProfile'),
    Markup.button.callback('🎫 Мои билеты', 'userTickets')
  ]);
  
  // Secondary actions
  keyboard.push([
    Markup.button.callback('⚔️ Рейды', 'userRaids'),
    Markup.button.callback('🎲 Кикстартеры', 'userKickstarters')
  ]);

  // Old months access
  keyboard.push([
    Markup.button.callback('📦 Предыдущие месяцы', 'oldMonthsMenu')
  ]);
  
  // Admin actions (if applicable)
  if (isAdmin) {
    keyboard.push([
      Markup.button.callback('⚙️ Админ панель', 'adminMenu')
    ]);
  }
  
  // Utility actions
  keyboard.push([
    Markup.button.callback('❓ Помощь', 'userHelp'),
    Markup.button.callback('🔄 Обновить', 'refreshUserStatus')
  ]);
  
  return {
    message,
    keyboard
  };
}

/**
 * Menu for preapproved users (need interview)
 */
function getPreapprovedUserMenu(ctx, userData) {
  return {
    message: `✅ <b>Заявка принята к рассмотрению</b>\n\n` +
            `Твоя заявка была принята к рассмотрению. Для прохождения собеседования свяжись с @test и используй кодовую фразу:\n\n` +
            `<code>гоблин-${ctx.from.id.toString().slice(-4)}</code>\n\n` +
            `После собеседования будет принято окончательное решение о твоем участии в сообществе.`,
    keyboard: [
      [Markup.button.callback('❓ Помощь', 'userHelp')]
    ]
  };
}

/**
 * Menu for pending users
 */
function getPendingUserMenu(ctx, userData) {
  return {
    message: `⏳ <b>Ожидай решения</b>\n\n` +
            `Твоя заявка находится на рассмотрении.\n\n` +
            `Мы изучим твой профиль и примем решение о допуске.\n\n` +
            `Уведомим тебя о результате.`,
    keyboard: [
      [Markup.button.callback('❓ Помощь', 'userHelp')]
    ]
  };
}

/**
 * Menu for rejected users
 */
function getRejectedUserMenu(ctx, userData) {
  return {
    message: `❌ <b>Заявка отклонена</b>\n\n` +
            `К сожалению, твоя заявка на участие в сообществе была отклонена.\n\n` +
            `Если у тебя есть вопросы, можешь обратиться к администрации.\n\n` +
            `Спасибо за понимание.`,
    keyboard: [
      [Markup.button.callback('❓ Помощь', 'userHelp')]
    ]
  };
}

/**
 * Menu for banned users
 */
function getBannedUserMenu(ctx, userData) {
  return {
    message: `🚫 <b>Доступ ограничен</b>\n\n` +
            `Твой доступ к боту был ограничен администрацией.\n\n` +
            `Если у тебя есть вопросы, можешь обратиться к администрации.\n\n` +
            `Спасибо за понимание.`,
    keyboard: []
  };
}

/**
 * Menu for self-banned users
 */
function getSelfBannedUserMenu(ctx, userData) {
  return {
    message: `🚫 <b>Доступ ограничен</b>\n\n` +
            `Ты ранее отказался от участия в сообществе.\n\n` +
            `Если передумал, можешь начать сначала с команды /start`,
    keyboard: [
      [Markup.button.callback('🔄 Начать сначала', 'whatIsIt')]
    ]
  };
}

/**
 * Menu for new users (no roles)
 */
function getNewUserMenu(ctx, userData) {
  return {
    message: `🌑 <b>Добро пожаловать в логово Главгоблина!</b>\n\n` +
            `Здесь копятся STL-сокровища. Но двери открываются лишь тем, кто готов заплатить звёздами из своей казны.\n\n` +
            `Хочешь узнать, что это такое?`,
    keyboard: [
      [Markup.button.callback('❓ Что это такое?', 'whatIsIt')]
    ]
  };
}

/**
 * Check if user has already joined the group (has a used invitation link)
 */
async function checkIfUserJoinedGroup(userId) {
  try {
    const usedLink = await knex('invitationLinks')
      .where('userId', Number(userId))
      .whereNotNull('usedAt')
      .where('useCount', '>', 0)
      .first();
    
    return !!usedLink;
  } catch (error) {
    console.error('Error checking if user joined group:', error);
    return false;
  }
}

/**
 * Mark invitation link as used
 */
async function markInvitationUsed(userId) {
  try {
    await knex('invitationLinks')
      .where('userId', Number(userId))
      .whereNull('usedAt')
      .update({
        usedAt: new Date(),
        useCount: 1
      });
    
    return { success: true };
  } catch (error) {
    console.error('Error marking invitation as used:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  getUserMenu,
  markInvitationUsed
};
