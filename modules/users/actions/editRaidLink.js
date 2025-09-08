const { Composer, Markup } = require("telegraf");
const raidsService = require('../../raids/db/raidsService');

module.exports = Composer.action(/^editRaidLink_(\d+)$/, async (ctx) => {
  try {
    const raidId = parseInt(ctx.match[1]);
    const userId = ctx.from.id;
    
    const raid = await raidsService.getRaidById(raidId);
    
    if (!raid || raid.created_by != userId) {
      await ctx.answerCbQuery('❌ Рейд не найден или вы не можете его редактировать', { show_alert: true });
      return;
    }
    
    ctx.session.editingRaid = { id: raidId, field: 'link' };
    
    const message = `✏️ <b>РЕДАКТИРОВАНИЕ ССЫЛКИ РЕЙДА #${raid.id}</b>\n\n` +
      `Текущая ссылка: ${raid.link || 'Не указана'}\n\n` +
      `Отправьте новую ссылку:`;
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', `editRaid_${raidId}`)]
      ])
    });
    
  } catch (error) {
    console.error('Error in editRaidLink:', error);
    await ctx.answerCbQuery(require('../../../modules/i18n').t('raids.common.loadError'), { show_alert: true });
  }
});
