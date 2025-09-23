const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { getAllUsers } = require('../../../db/helpers');

module.exports = Composer.action('adminRemindLevels', async (ctx) => {
  const userId = ctx.callbackQuery.from.id;

  if (userId != SETTINGS.CHATS.EPINETOV && userId != SETTINGS.CHATS.GLAVGOBLIN) {
    return;
  }

  await ctx.editMessageText('🔔 <b>Выберите уровень напоминания</b>\n\nВыберите, насколько настойчиво напомнить гоблинам о необходимости оплаты:', {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔔 Мягкое', 'adminRemind_soft'),
        Markup.button.callback('⚔️ Среднее', 'adminRemind_medium'),
        Markup.button.callback('💀 Жёсткое', 'adminRemind_hard')
      ],
      [
        Markup.button.callback('← Назад', 'adminMonths'),
      ]
    ])
  });
});
