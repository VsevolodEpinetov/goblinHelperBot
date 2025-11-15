const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const { getUser } = require('../../db/helpers');
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('userStats', async (ctx) => {
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData) return;

  const totalMonths = userData.purchases.groups.regular.length + userData.purchases.groups.plus.length;
  const plusRatio = userData.purchases.groups.plus.length > 0 ? 
    Math.round((userData.purchases.groups.plus.length / totalMonths) * 100) : 0;
  
  // Get scrolls from new system
  const { getUserScrolls } = require('../../util/scrolls');
  const userScrolls = await getUserScrolls(ctx.callbackQuery.from.id);
  const totalScrolls = userScrolls.reduce((total, scroll) => total + scroll.amount, 0);
  const scrollsList = userScrolls.map(s => `${s.name}: ${s.amount}`).join(', ') || 'Нет';
  
  const statsMessage = `${t('messages.months.title')}\n\n` +
    `👤 <b>Пользователь:</b> ${userData.first_name}\n` +
    `📅 <b>Дата регистрации:</b> ${userData.created_at || 'Не указана'}\n\n` +
    `🎯 <b>ОБЩАЯ СТАТИСТИКА:</b>\n` +
    `• <b>Всего месяцев:</b> ${totalMonths}\n` +
    `• <b>Обычные подписки:</b> ${userData.purchases.groups.regular.length}\n` +
    `• <b>➕ Подписки:</b> ${userData.purchases.groups.plus.length}\n` +
    `• <b>Процент ➕:</b> ${plusRatio}%\n\n` +
    `📜 <b>СВИТКИ:</b> ${totalScrolls} (${scrollsList})\n\n` +
    `🚀 <b>АКТИВНОСТЬ:</b>\n` +
    `• <b>Кикстартеры:</b> ${userData.purchases.kickstarters.length}\n` +
    `• <b>Коллекции:</b> ${userData.purchases.collections.length}`;

  const statsKeyboard = [
    [Markup.button.callback('📈 Детальная статистика', 'detailedStats'), Markup.button.callback('🏆 Достижения', 'userAchievements')],
    [Markup.button.callback('📊 Экспорт данных', 'exportUserData'), Markup.button.callback(t('messages.back'), 'userMenu')]
  ];

  await ctx.editMessageText(statsMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(statsKeyboard)
  });
});
