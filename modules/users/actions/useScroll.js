const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const { getUser } = require('../../db/helpers');

module.exports = Composer.action('useScroll', async (ctx) => {
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData) return;

  const scrolls = Math.floor(userData.purchases.groups.plus.length / 3) * 2 - userData.purchases.scrollsSpent;
  
  if (scrolls <= 0) {
    await ctx.answerCbQuery('❌ У вас нет доступных свитков!');
    return;
  }

  const scrollMessage = `📜 <b>ИСПОЛЬЗОВАНИЕ СВИТКА</b>\n\n` +
    `📜 <b>Доступно свитков:</b> ${scrolls}\n\n` +
    `🚀 <b>Что можно купить за свиток:</b>\n` +
    `• <b>Кикстартер проект</b> - любой доступный проект\n` +
    `• <b>Эксклюзивный контент</b> - специальные материалы\n` +
    `• <b>Ранний доступ</b> - приоритет к новым релизам\n` +
    `• <b>Специальные предложения</b> - уникальные возможности\n\n` +
    `💡 <b>Как получить больше свитков:</b>\n` +
    `Покупайте ➕ подписки! За каждые 3 месяца ➕ вы получаете 2 свитка.`;

  const scrollKeyboard = [
    [
      Markup.button.callback('🚀 Кикстартеры', 'scrollKickstarters'),
      Markup.button.callback('⭐ Эксклюзив', 'scrollExclusive')
    ],
    [
      Markup.button.callback('🎁 Спецпредложения', 'scrollSpecial'),
      Markup.button.callback('📅 Ранний доступ', 'scrollEarlyAccess')
    ],
    [Markup.button.callback(require('../../../modules/i18n').t('messages.back'), 'userMenu')]
  ];

  await ctx.editMessageText(scrollMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(scrollKeyboard)
  });
});
