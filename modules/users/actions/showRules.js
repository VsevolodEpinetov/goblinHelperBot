const { Composer, Markup } = require("telegraf");
const util = require('../../util');

module.exports = Composer.action('showRules', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  // Step 3: Rules explanation
  const rulesMessage = '📜 <b>Законы логова</b>\n\n' +
'Слушай внимательно:\n\n' +
'⚔ 1. Вход только по взносу. Нет оплаты — нет доступа.\n' +
'🔕 2. Сливы и перепродажа STL = мгновенный бан без возврата.\n' +
'🗿 3. Политику и склоки оставь за дверью. Здесь только 3D-печать.\n' +
'💀 4. Нарушил хоть одно правило — вылетел. Второго шанса нет.\n\n';

  await ctx.editMessageText(rulesMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback("🔥 Хорошо", 'readyToParticipate')]
    ])
  });
});


