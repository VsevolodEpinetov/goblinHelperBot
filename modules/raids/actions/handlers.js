const { Composer } = require('telegraf');

const handlers = new Composer();

// Debug all callback queries
handlers.on('callback_query', (ctx, next) => {
  console.log('🔍 Raids handlers: Callback query received:', ctx.callbackQuery.data);
  console.log('🔍 Raids handlers: Calling next()...');
  return next();
});

// Join raid action
handlers.action(/^raid_join_(\d+)$/, (ctx) => {
  console.log('🔍 Join action handler matched!', ctx.callbackQuery.data, ctx.match);
  return require('./join')(ctx);
});

console.log('🔍 Raids handlers: Action handlers registered');

// Leave raid action
handlers.action(/^raid_leave_(\d+)$/, require('./leave'));

// Raid info action
handlers.action(/^raid_info_(\d+)$/, require('../commands/info'));

// Raid list action
handlers.action('raid_list', require('../commands/list'));

// Close raid action
handlers.action(/^raid_close_(\d+)$/, async (ctx) => {
  try {
    const raidId = parseInt(ctx.match[1]);
    const userId = ctx.from.id;
    
    const raidsService = require('../db/raidsService');
    const result = await raidsService.closeRaid(raidId, userId);
    
    if (!result.success) {
      await ctx.answerCbQuery(`❌ ${result.error}`, { show_alert: true });
      return;
    }

    await ctx.answerCbQuery('✅ Рейд закрыт');
    
    // Update message to show closed status
    const raid = await raidsService.getRaidById(raidId);
    if (raid) {
      const message = `🔒 <b>Рейд #${raidId} ЗАКРЫТ</b>\n\n` +
        `💰 <b>Общая стоимость:</b> ${raid.price} ${raid.currency}\n` +
        `👥 <b>Участников:</b> ${raid.participants.length} чел.\n` +
        `💵 <b>С человека:</b> ${raid.participants.length > 0 ? (raid.price / raid.participants.length).toFixed(2) : raid.price} ${raid.currency}\n\n` +
        `📄 <b>Описание:</b>\n${raid.description || 'Описание не указано'}\n\n` +
        `🔗 <b>Ссылка:</b> ${raid.link || 'Не указана'}\n\n` +
        `📅 <b>Дата окончания:</b> ${raid.end_date ? new Date(raid.end_date).toLocaleDateString('ru-RU') : 'Не указана'}\n\n` +
        `📊 <b>Статус:</b> 🔴 Закрыт`;

      const keyboard = require('telegraf').Markup.inlineKeyboard([
        [require('telegraf').Markup.button.callback('ℹ️ Информация', `raid_info_${raidId}`)],
        [require('telegraf').Markup.button.callback('🔙 Назад', 'back_to_raids')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...keyboard
      });

      // Loyalty: grant XP on raid completion to creator and participants
      try {
        const { applyDirectXp } = require('../../loyalty/xpService');
        const creatorId = raid.created_by;
        await applyDirectXp(Number(creatorId), 75, 'raid_create', { raidId });
        const participantIds = (raid.participants || []).map(p => p.user_id);
        for (const pid of participantIds) {
          await applyDirectXp(Number(pid), 50, 'raid_complete', { raidId });
        }
      } catch (xpErr) {
        console.error('⚠️ Loyalty XP apply error on raid close (non-fatal):', xpErr);
      }
    }

  } catch (error) {
    console.error('Error closing raid:', error);
    await ctx.answerCbQuery('❌ Произошла ошибка при закрытии рейда', { show_alert: true });
  }
});

module.exports = handlers;
