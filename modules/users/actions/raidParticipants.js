const { Composer, Markup } = require("telegraf");
const raidsService = require('../../raids/db/raidsService');
const { t } = require('../../../modules/i18n');

module.exports = Composer.action(/^raidParticipants_(\d+)$/, async (ctx) => {
  try {
    const raidId = parseInt(ctx.match[1]);
    const userId = ctx.from.id;
    
    // Get raid details
    const raid = await raidsService.getRaidById(raidId);
    
    if (!raid) { await ctx.answerCbQuery(t('raids.common.notFound'), { show_alert: true }); return; }
    
    // Check if user is the creator
    if (raid.created_by !== userId) { await ctx.answerCbQuery(t('raids.common.noPermission'), { show_alert: true }); return; }
    
    const participantCount = raid.participants ? raid.participants.length : 0;
    
    if (participantCount === 0) {
      const message = `${t('raids.participants.title')}\n\n${t('raids.participants.none')}`;

      const keyboard = Markup.inlineKeyboard([[Markup.button.callback(t('raids.buttons.backToManage'), `manageRaid_${raidId}`)]]);

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...keyboard
      });
      return;
    }

    let message = `${t('raids.participants.title')}\n\nРейд #${raidId} • ${participantCount} участников\n\n`;
    
    // List participants with management options
    raid.participants.forEach((participant, index) => {
      const name = participant.username ? `@${participant.username}` : `${participant.first_name} ${participant.last_name}`.trim();
      const isCreator = participant.user_id === raid.created_by;
      
      message += `${index + 1}. <b>${name}</b>\n`;
      if (isCreator) {
        message += `   ${t('raids.participants.creator')}\n`;
      } else {
        message += `   ${t('raids.participants.joined')} ${new Date(participant.joined_at).toLocaleDateString('ru-RU')}\n`;
      }
      message += `\n`;
    });

    const keyboard = Markup.inlineKeyboard([
      ...raid.participants
        .filter(p => p.user_id !== raid.created_by) // Don't show creator in management
        .slice(0, 10) // Limit to 10 participants for UI
        .map(participant => [
          Markup.button.callback(
            t('raids.participants.exclude', { name: participant.username ? `@${participant.username}` : participant.first_name }),
            `excludeParticipant_${raidId}_${participant.user_id}`
          )
        ]),
      [Markup.button.callback(t('raids.buttons.backToManage'), `manageRaid_${raidId}`)]
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...keyboard
    });

  } catch (error) { console.error('Error in raidParticipants:', error); await ctx.answerCbQuery(t('raids.common.loadError'), { show_alert: true }); }
});
