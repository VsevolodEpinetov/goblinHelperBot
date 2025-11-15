const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const { getKickstarter } = require('../../../db/helpers');

module.exports = Composer.action(/^adminSelectKickstarter_(\d+)$/, async (ctx) => {
  // Check for super user and DM
  if (!util.isSuperUser(ctx.callbackQuery.from.id)) {
    await ctx.answerCbQuery('❌ Только супер-пользователи могут редактировать кикстартеры');
    return;
  }

  if (ctx.chat.type !== 'private') {
    await ctx.answerCbQuery('❌ Редактирование доступно только в личных сообщениях');
    return;
  }

  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (e) {
    await ctx.replyWithHTML(`Из-за ограничений телеграма тебе нужно использовать /start ещё раз. Старое сообщение останется, можешь его удалить вручную, если мешает.`);
    return;
  }

  const index = parseInt(ctx.callbackQuery.data.split('_')[1]);
  const projectID = ctx.session.searchResults[index];
  
  if (!projectID) {
    await ctx.reply('❌ Кикстартер не найден');
    return;
  }

  const projectData = await getKickstarter(projectID);
  
  if (!projectData) {
    await ctx.reply('❌ Данные кикстартера не найдены');
    return;
  }

  // Store selected kickstarter ID in session
  ctx.session.editingKickstarter = { id: projectID };

  let message = `📦 <b>Кикстартер #${projectID}</b>\n\n`;
  message += `<b>Название:</b> ${projectData.name}\n`;
  message += `<b>Автор:</b> ${projectData.creator}\n`;
  message += `<b>Пледж:</b> ${projectData.pledgeName || 'Не указан'}\n`;
  message += `<b>Цена:</b> ${projectData.cost}⭐\n`;
  message += `<b>Файлов:</b> ${projectData.files.length}\n`;
  message += `<b>Фото:</b> ${projectData.photos.length}\n`;
  
  if (projectData.link) {
    message += `\n🔗 <a href="${projectData.link}">Ссылка</a>`;
  }

  const keyboard = [
    [
      Markup.button.callback('✏️ Изменить название', `editKickstarterName_${projectID}`),
      Markup.button.callback('✏️ Изменить автора', `editKickstarterCreator_${projectID}`)
    ],
    [
      Markup.button.callback('✏️ Изменить пледж', `editKickstarterPledge_${projectID}`),
      Markup.button.callback('✏️ Изменить цену', `editKickstarterPrice_${projectID}`)
    ],
    [
      Markup.button.callback('📁 Заменить файлы', `replaceFilesKickstarter_${projectID}`),
      Markup.button.callback('📁 Добавить файлы', `addFilesKickstarter_${projectID}`)
    ],
    [
      Markup.button.callback('📢 Отправить промо', `resendKickstarterPromo_${projectID}`)
    ],
    [
      Markup.button.callback('🔙 Назад', 'adminKickstarters')
    ]
  ];

  await ctx.replyWithHTML(message, {
    ...Markup.inlineKeyboard(keyboard)
  });
});