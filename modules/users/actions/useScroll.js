const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const { getUser } = require('../../db/helpers');

module.exports = Composer.action('useScroll', async (ctx) => {
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData) return;

  // Get scrolls from new system
  const { getUserScrolls } = require('../../util/scrolls');
  const userScrolls = await getUserScrolls(ctx.callbackQuery.from.id);
  const totalScrolls = userScrolls.reduce((total, scroll) => total + scroll.amount, 0);
  
  if (totalScrolls <= 0) {
    await ctx.answerCbQuery('❌ У вас нет доступных свитков!');
    return;
  }

  let scrollsList = '';
  if (userScrolls.length > 0) {
    scrollsList = userScrolls.map(s => `• ${s.name}: ${s.amount} шт.`).join('\n');
  }

  const scrollMessage = `📜 <b>ИСПОЛЬЗОВАНИЕ СВИТКА</b>\n\n` +
    `📜 <b>Доступно свитков:</b> ${totalScrolls}\n\n` +
    `${scrollsList ? `<b>Твои свитки:</b>\n${scrollsList}\n\n` : ''}` +
    `🚀 <b>Что можно купить за свиток:</b>\n` +
    `• <b>Кикстартер проект</b> - любой доступный проект\n` +
    `• <b>Эксклюзивный контент</b> - специальные материалы\n` +
    `• <b>Ранний доступ</b> - приоритет к новым релизам\n` +
    `• <b>Специальные предложения</b> - уникальные возможности\n\n` +
    `💡 <b>Как получить больше свитков:</b>\n` +
    `Свитки выдаются администрацией за различные достижения и активность.`;

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
