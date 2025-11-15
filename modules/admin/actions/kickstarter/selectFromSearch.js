const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const { getKickstarter } = require('../../../db/helpers');

module.exports = Composer.action(/^adminSelectKickstarter_(\d+)$/, async (ctx) => {
  // Check for super user
  if (!util.isSuperUser(ctx.callbackQuery.from.id)) {
    await ctx.answerCbQuery('❌ Только супер-пользователи могут редактировать кикстартеры');
    return;
  }

  // Check for DM context
  if (ctx.chat.type !== 'private') {
    await ctx.answerCbQuery('❌ Редактирование доступно только в личных сообщениях');
    return;
  }

  try {
    const index = parseInt(ctx.match[1]);
    const kickstarterId = ctx.session.searchResults?.[index];

    if (!kickstarterId) {
      await ctx.answerCbQuery('❌ Кикстартер не найден');
      return;
    }

    const kickstarterData = await getKickstarter(kickstarterId);

    if (!kickstarterData) {
      await ctx.answerCbQuery('❌ Данные кикстартера не найдены');
      return;
    }

    // Build details message
    let message = `📦 <b>Кикстартер #${kickstarterId}</b>\n\n`;
    message += `<b>Название:</b> ${kickstarterData.name}\n`;
    message += `<b>Автор:</b> ${kickstarterData.creator}\n`;
    if (kickstarterData.pledgeName) {
      message += `<b>Пледж:</b> ${kickstarterData.pledgeName}\n`;
    }
    if (kickstarterData.pledgeCost) {
      message += `<b>Оригинальная стоимость:</b> $${kickstarterData.pledgeCost}\n`;
    }
    message += `<b>Стоимость:</b> ${kickstarterData.cost} ⭐\n`;
    if (kickstarterData.link) {
      message += `\n${kickstarterData.link}\n`;
    }
    message += `\n<b>Картинок:</b> ${kickstarterData.photos?.length || 0}\n`;
    message += `<b>Файлов:</b> ${kickstarterData.files?.length || 0}`;

    const keyboard = [
      [
        Markup.button.callback('✏️ Изменить название', `adminEditKickstarterName_${kickstarterId}`),
        Markup.button.callback('✏️ Изменить создателя', `adminEditKickstarterCreator_${kickstarterId}`)
      ],
      [
        Markup.button.callback('✏️ Изменить пледж', `adminEditKickstarterPledge_${kickstarterId}`),
        Markup.button.callback('💰 Изменить цену', `adminEditKickstarterPrice_${kickstarterId}`)
      ],
      [
        Markup.button.callback('📁 Заменить файлы', `adminReplaceKickstarterFiles_${kickstarterId}`),
        Markup.button.callback('➕ Добавить файлы', `adminAddKickstarterFiles_${kickstarterId}`)
      ],
      [
        Markup.button.callback('📢 Отправить промо', `adminResendKickstarterPromo_${kickstarterId}`)
      ],
      [
        Markup.button.callback('🔙 Назад', 'adminKickstarters')
      ]
    ];

    try {
      await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
    } catch (e) {
      // Message might not be deletable, continue anyway
    }

    await ctx.replyWithHTML(message, Markup.inlineKeyboard(keyboard));
  } catch (error) {
    console.error('Error in selectKickstarter:', error);
    await ctx.answerCbQuery('❌ Ошибка при загрузке данных');
  }
});

