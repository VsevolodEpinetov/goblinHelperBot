const { Composer, Markup } = require("telegraf");
const raidsService = require('../../raids/db/raidsService');

module.exports = Composer.action(/^editRaidPrice_(\d+)$/, async (ctx) => {
  try {
    const raidId = parseInt(ctx.match[1]);
    const userId = ctx.from.id;
    
    const raid = await raidsService.getRaidById(raidId);
    
    if (!raid || raid.created_by != userId) {
      await ctx.answerCbQuery('❌ Рейд не найден или вы не можете его редактировать', { show_alert: true });
      return;
    }
    
    ctx.session.editingRaid = { id: raidId, field: 'price' };
    
    const message = `✏️ <b>РЕДАКТИРОВАНИЕ ЦЕНЫ РЕЙДА #${raid.id}</b>\n\n` +
      `Текущая цена: <b>${raid.price} ${raid.currency}</b>\n\n` +
      `Отправьте новую цену (только число):`;
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', `editRaid_${raidId}`)]
      ])
    });
    
  } catch (error) {
    console.error('Error in editRaidPrice:', error);
    await ctx.answerCbQuery(require('../../../modules/i18n').t('raids.common.loadError'), { show_alert: true });
  }
});
