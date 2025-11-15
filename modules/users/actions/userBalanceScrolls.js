const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const { getUser } = require('../../db/helpers');

module.exports = Composer.action('userBalanceScrolls', async (ctx) => {
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData) return;

  // Get scrolls from new system
  const { getUserScrolls } = require('../../util/scrolls');
  const userScrolls = await getUserScrolls(ctx.callbackQuery.from.id);
  const totalScrolls = userScrolls.reduce((total, scroll) => total + scroll.amount, 0);
  
  let scrollsDetails = '';
  if (userScrolls.length > 0) {
    scrollsDetails = userScrolls.map(s => `• ${s.name}: ${s.amount} шт.`).join('\n');
  } else {
    scrollsDetails = 'Нет доступных свитков';
  }
  
  const balanceMessage = `💰 <b>БАЛАНС И СВИТКИ</b>\n\n` +
    `💳 <b>Текущий баланс:</b> ${userData.purchases.balance}₽\n` +
    `📜 <b>Доступно свитков:</b> ${totalScrolls}\n\n` +
    `📊 <b>Детализация свитков:</b>\n${scrollsDetails}\n\n` +
    `💡 <b>Как получить свитки:</b>\n` +
    `Свитки выдаются администрацией за различные достижения и активность.`;

  const balanceKeyboard = [
    [
      Markup.button.callback('💳 Пополнить баланс', 'addBalance'),
      Markup.button.callback('📜 Использовать свиток', 'useScroll')
    ],
    [
      Markup.button.callback('📊 История операций', 'transactionHistory'),
      Markup.button.callback(require('../../../modules/i18n').t('messages.back'), 'userMenu')
    ]
  ];

  await ctx.editMessageText(balanceMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(balanceKeyboard)
  });
});
