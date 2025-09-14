const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const { getUser } = require('../../db/helpers');

module.exports = Composer.action('userBalanceScrolls', async (ctx) => {
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData) return;

  const scrolls = Math.floor(userData.purchases.groups.plus.length / 3) * 2 - userData.purchases.scrollsSpent;
  
  const balanceMessage = `💰 <b>БАЛАНС И СВИТКИ</b>\n\n` +
    `💳 <b>Текущий баланс:</b> ${userData.purchases.balance}₽\n` +
    `📜 <b>Доступно свитков:</b> ${scrolls}\n\n` +
    `📊 <b>Детализация:</b>\n` +
    `• <b>Плюс подписки:</b> ${userData.purchases.groups.plus.length}\n` +
    `• <b>Свитки заработано:</b> ${Math.floor(userData.purchases.groups.plus.length / 3) * 2}\n` +
    `• <b>Свитки потрачено:</b> ${userData.purchases.scrollsSpent}\n\n` +
    `💡 <b>Как получить свитки:</b>\n` +
    `Покупайте ➕ подписки! За каждые 3 месяца ➕ вы получаете 2 свитка.`;

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
