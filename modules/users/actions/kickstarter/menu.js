const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const { getUser } = require('../../../db/helpers');

module.exports = Composer.action('userKickstarters', async (ctx) => {
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData) return;

  const tickets = Math.floor(userData.purchases.groups.plus.length / 3) * 2 - userData.purchases.ticketsSpent;
  const purchasedKickstarters = userData.purchases.kickstarters.length;
  const availableKickstarters = 5; // Example number
  
  const kickstarterMessage = `🚀 <b>КИКСТАРТЕРЫ И ПРОЕКТЫ</b>\n\n` +
    `🎯 <b>Ваши возможности:</b>\n` +
    `• <b>Билетики:</b> ${tickets} доступно\n` +
    `• <b>Куплено проектов:</b> ${purchasedKickstarters}\n` +
    `• <b>Доступно проектов:</b> ${availableKickstarters}\n\n` +
    `💡 <b>Как это работает:</b>\n` +
    `• Билетики получаются за ➕ подписки\n` +
    `• 1 билетик = 1 проект\n` +
    `• Проекты доступны сразу после покупки\n` +
    `• Материалы приходят по мере готовности\n\n` +
    `🎁 <b>Что включено в проект:</b>\n` +
    `• Доступ к эксклюзивному контенту\n` +
    `• Ранние релизы и обновления\n` +
    `• Специальные материалы\n` +
    `• Участие в бета-тестировании\n\n` +
    `📊 <b>Рекомендации:</b>\n` +
    `${tickets > 0 ? '✅ У вас есть билетики - можете покупать проекты!' : '❌ Нет билетиков - купите ➕ подписку для получения билетиков'}`;

  const kickstarterKeyboard = [];
  
  // Primary actions based on available tickets
  if (tickets > 0) {
    kickstarterKeyboard.push([
      Markup.button.callback('🛒 Купить проект', 'browseKickstarters'),
      Markup.button.callback('🎟 Использовать билетик', 'useTicket')
    ]);
  } else {
    kickstarterKeyboard.push([
      Markup.button.callback('⭐ Купить ➕ подписку', 'addPlusToCurrentMonth'),
      Markup.button.callback('💳 Пополнить баланс', 'addBalance')
    ]);
  }
  
  // Standard actions
  kickstarterKeyboard.push([
    Markup.button.callback('📋 Мои проекты', 'myKickstarters'),
    Markup.button.callback('🔍 Поиск проектов', 'searchKickstarters')
  ]);
  
  kickstarterKeyboard.push([
    Markup.button.callback('📊 Статистика', 'kickstarterStats'),
    Markup.button.callback('❓ Помощь', 'kickstarterHelp')
  ]);
  
  // Navigation
  kickstarterKeyboard.push([
    Markup.button.callback('🔙 Назад в меню', 'userMenu'),
    Markup.button.callback('🏠 В главное меню', 'userMenu')
  ]);

  await ctx.editMessageText(kickstarterMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(kickstarterKeyboard)
  });
});