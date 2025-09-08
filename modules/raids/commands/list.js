const { Markup } = require('telegraf');
const raidsService = require('../db/raidsService');

module.exports = async (ctx) => {
  try {
    // Get open raids
    const raids = await raidsService.getRaids({ status: 'open' });
    
    if (raids.length === 0) {
      const message = `⚔️ <b>Активные рейды</b>\n\n` +
        `🔍 <b>Нет активных рейдов</b>\n\n` +
        `💡 <b>Создайте новый рейд командой:</b>\n` +
        `<code>Гоблины, на рейд!</code>`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', 'raid_list')],
        [Markup.button.callback('🔙 Назад', 'back_to_main')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...keyboard
      });
      return;
    }

    // Format raids list
    let message = `⚔️ <b>Активные рейды (${raids.length})</b>\n\n`;
    
    raids.forEach((raid, index) => {
      const participantCount = raid.participants ? raid.participants.length : 0;
      const pricePerPerson = participantCount > 0 ? (raid.price / participantCount).toFixed(2) : raid.price;
      
      message += `${index + 1}. <b>Рейд #${raid.id}</b>\n` +
        `   💰 ${raid.price} ${raid.currency} (${pricePerPerson} с чел.)\n` +
        `   👥 ${participantCount} участников\n` +
        `   📅 ${raid.end_date ? new Date(raid.end_date).toLocaleDateString('ru-RU') : 'Без даты'}\n\n`;
    });

    // Create keyboard with raid buttons
    const keyboard = [];
    raids.forEach((raid, index) => {
      if (index % 2 === 0) {
        keyboard.push([
          Markup.button.callback(`#${raid.id}`, `raid_info_${raid.id}`)
        ]);
      } else {
        keyboard[keyboard.length - 1].push(
          Markup.button.callback(`#${raid.id}`, `raid_info_${raid.id}`)
        );
      }
    });

    // Add control buttons
    keyboard.push([
      Markup.button.callback('🔄 Обновить', 'raid_list'),
      Markup.button.callback('🔙 Назад', 'back_to_main')
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });

  } catch (error) {
    console.error('Error getting raids list:', error);
    // Only use answerCbQuery if this is a callback query
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('❌ Произошла ошибка при получении списка рейдов', { show_alert: true });
    }
  }
};
