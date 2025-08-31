const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const { getUser } = require('../../db/helpers');

module.exports = Composer.action('userStats', async (ctx) => {
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData) return;

  const tickets = Math.floor(userData.purchases.groups.plus.length / 3) * 2 - userData.purchases.ticketsSpent;
  const totalMonths = userData.purchases.groups.regular.length + userData.purchases.groups.plus.length;
  const plusRatio = userData.purchases.groups.plus.length > 0 ? 
    Math.round((userData.purchases.groups.plus.length / totalMonths) * 100) : 0;
  
  const statsMessage = `📊 <b>СТАТИСТИКА АККАУНТА</b>\n\n` +
    `👤 <b>Пользователь:</b> ${userData.first_name}\n` +
    `📅 <b>Дата регистрации:</b> ${userData.created_at || 'Не указана'}\n\n` +
    `🎯 <b>ОБЩАЯ СТАТИСТИКА:</b>\n` +
    `• <b>Всего месяцев:</b> ${totalMonths}\n` +
    `• <b>Обычные подписки:</b> ${userData.purchases.groups.regular.length}\n` +
    `• <b>➕ Подписки:</b> ${userData.purchases.groups.plus.length}\n` +
    `• <b>Процент ➕:</b> ${plusRatio}%\n\n` +
    `💰 <b>ФИНАНСОВАЯ СТАТИСТИКА:</b>\n` +
    `• <b>Текущий баланс:</b> ${userData.purchases.balance}₽\n` +
    `• <b>Билетики:</b> ${tickets} (${Math.floor(userData.purchases.groups.plus.length / 3) * 2} заработано, ${userData.purchases.ticketsSpent} потрачено)\n\n` +
    `🚀 <b>АКТИВНОСТЬ:</b>\n` +
    `• <b>Кикстартеры:</b> ${userData.purchases.kickstarters.length}\n` +
    `• <b>Коллекции:</b> ${userData.purchases.collections.length}\n\n` +
    `🏆 <b>ДОСТИЖЕНИЯ:</b>\n` +
    `${totalMonths >= 12 ? '🥇 Годовик - 12+ месяцев' : totalMonths >= 6 ? '🥈 Полугодовик - 6+ месяцев' : totalMonths >= 3 ? '🥉 Квартальщик - 3+ месяца' : '🆕 Новенький'}\n` +
    `${userData.purchases.groups.plus.length >= 3 ? '⭐ Плюс мастер - 3+ ➕ месяца' : ''}\n` +
    `${tickets >= 5 ? '🎟 Билетный магнат - 5+ билетиков' : ''}`;

  const statsKeyboard = [
    [
      Markup.button.callback('📈 Детальная статистика', 'detailedStats'),
      Markup.button.callback('🏆 Достижения', 'userAchievements')
    ],
    [
      Markup.button.callback('📊 Экспорт данных', 'exportUserData'),
      Markup.button.callback('🔙 Назад', 'userMenu')
    ]
  ];

  await ctx.editMessageText(statsMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(statsKeyboard)
  });
});
