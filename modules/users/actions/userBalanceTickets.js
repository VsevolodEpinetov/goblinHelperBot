const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const { getUser } = require('../../db/helpers');

module.exports = Composer.action('userBalanceTickets', async (ctx) => {
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData) return;

  const tickets = Math.floor(userData.purchases.groups.plus.length / 3) * 2 - userData.purchases.ticketsSpent;
  
  const balanceMessage = `💰 <b>БАЛАНС И БИЛЕТИКИ</b>\n\n` +
    `💳 <b>Текущий баланс:</b> ${userData.purchases.balance}₽\n` +
    `🎟 <b>Доступно билетиков:</b> ${tickets}\n\n` +
    `📊 <b>Детализация:</b>\n` +
    `• <b>Плюс подписки:</b> ${userData.purchases.groups.plus.length}\n` +
    `• <b>Билетики заработано:</b> ${Math.floor(userData.purchases.groups.plus.length / 3) * 2}\n` +
    `• <b>Билетики потрачено:</b> ${userData.purchases.ticketsSpent}\n\n` +
    `💡 <b>Как получить билетики:</b>\n` +
    `Покупайте ➕ подписки! За каждые 3 месяца ➕ вы получаете 2 билетика.`;

  const balanceKeyboard = [
    [
      Markup.button.callback('💳 Пополнить баланс', 'addBalance'),
      Markup.button.callback('🎟 Использовать билетик', 'useTicket')
    ],
    [
      Markup.button.callback('📊 История операций', 'transactionHistory'),
      Markup.button.callback('🔙 Назад', 'userMenu')
    ]
  ];

  await ctx.editMessageText(balanceMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(balanceKeyboard)
  });
});
