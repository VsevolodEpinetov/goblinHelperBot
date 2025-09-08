const { Composer, Markup } = require("telegraf");
const { t } = require('../../../modules/i18n');
const raidsService = require('../../raids/db/raidsService');

module.exports = Composer.action(/^editRaid_(\d+)$/, async (ctx) => {
  try {
    const raidId = parseInt(ctx.match[1]);
    const userId = ctx.from.id;
    
    // Get raid details
    const raid = await raidsService.getRaidById(raidId);
    
    if (!raid) { await ctx.answerCbQuery(t('raids.common.notFound'), { show_alert: true }); return; }
    
    // Check if user is the creator
    if (raid.created_by != userId) { await ctx.answerCbQuery(t('raids.common.noPermission'), { show_alert: true }); return; }
    
    const message = `✏️ <b>РЕДАКТИРОВАНИЕ РЕЙДА #${raid.id}</b>\n\nВыберите, что хотите изменить:`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📝 Название', `editRaidTitle_${raidId}`)],
      [Markup.button.callback('📄 Описание', `editRaidDescription_${raidId}`)],
      [Markup.button.callback('🔗 Ссылка', `editRaidLink_${raidId}`)],
      [Markup.button.callback('💰 Цена', `editRaidPrice_${raidId}`)],
      [Markup.button.callback('📅 Дата окончания', `editRaidDate_${raidId}`)],
      [Markup.button.callback(t('raids.buttons.backToManage'), `manageRaid_${raidId}`)]
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...keyboard
    });
    
  } catch (error) { console.error('Error in editRaid:', error); await ctx.answerCbQuery(t('raids.common.loadError'), { show_alert: true }); }
});
