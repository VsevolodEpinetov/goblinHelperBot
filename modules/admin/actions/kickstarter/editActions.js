const { Composer } = require("telegraf");
const util = require('../../../util');

// Edit name action
const editName = Composer.action(/^editKickstarterName_(\d+)$/, async (ctx) => {
  if (!util.isSuperUser(ctx.callbackQuery.from.id)) {
    await ctx.answerCbQuery('❌ Только супер-пользователи могут редактировать кикстартеры');
    return;
  }

  if (ctx.chat.type !== 'private') {
    await ctx.answerCbQuery('❌ Редактирование доступно только в личных сообщениях');
    return;
  }

  const kickstarterId = parseInt(ctx.callbackQuery.data.split('_')[1]);
  ctx.session.editingKickstarter = { id: kickstarterId };
  
  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (e) {
    // Continue anyway
  }
  
  ctx.scene.enter('ADMIN_SCENE_EDIT_KICKSTARTER_NAME');
});

// Edit creator action
const editCreator = Composer.action(/^editKickstarterCreator_(\d+)$/, async (ctx) => {
  if (!util.isSuperUser(ctx.callbackQuery.from.id)) {
    await ctx.answerCbQuery('❌ Только супер-пользователи могут редактировать кикстартеры');
    return;
  }

  if (ctx.chat.type !== 'private') {
    await ctx.answerCbQuery('❌ Редактирование доступно только в личных сообщениях');
    return;
  }

  const kickstarterId = parseInt(ctx.callbackQuery.data.split('_')[1]);
  ctx.session.editingKickstarter = { id: kickstarterId };
  
  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (e) {
    // Continue anyway
  }
  
  ctx.scene.enter('ADMIN_SCENE_EDIT_KICKSTARTER_CREATOR');
});

// Edit pledge action
const editPledge = Composer.action(/^editKickstarterPledge_(\d+)$/, async (ctx) => {
  if (!util.isSuperUser(ctx.callbackQuery.from.id)) {
    await ctx.answerCbQuery('❌ Только супер-пользователи могут редактировать кикстартеры');
    return;
  }

  if (ctx.chat.type !== 'private') {
    await ctx.answerCbQuery('❌ Редактирование доступно только в личных сообщениях');
    return;
  }

  const kickstarterId = parseInt(ctx.callbackQuery.data.split('_')[1]);
  ctx.session.editingKickstarter = { id: kickstarterId };
  
  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (e) {
    // Continue anyway
  }
  
  ctx.scene.enter('ADMIN_SCENE_EDIT_KICKSTARTER_PLEDGE');
});

// Edit price action
const editPrice = Composer.action(/^editKickstarterPrice_(\d+)$/, async (ctx) => {
  if (!util.isSuperUser(ctx.callbackQuery.from.id)) {
    await ctx.answerCbQuery('❌ Только супер-пользователи могут редактировать кикстартеры');
    return;
  }

  if (ctx.chat.type !== 'private') {
    await ctx.answerCbQuery('❌ Редактирование доступно только в личных сообщениях');
    return;
  }

  const kickstarterId = parseInt(ctx.callbackQuery.data.split('_')[1]);
  ctx.session.editingKickstarter = { id: kickstarterId };
  
  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (e) {
    // Continue anyway
  }
  
  ctx.scene.enter('ADMIN_SCENE_EDIT_KICKSTARTER_PRICE');
});

// Resend promo action
const resendPromo = Composer.action(/^resendKickstarterPromo_(\d+)$/, async (ctx) => {
  if (!util.isSuperUser(ctx.callbackQuery.from.id)) {
    await ctx.answerCbQuery('❌ Только супер-пользователи могут отправлять промо');
    return;
  }

  if (ctx.chat.type !== 'private') {
    await ctx.answerCbQuery('❌ Отправка промо доступна только в личных сообщениях');
    return;
  }

  const kickstarterId = parseInt(ctx.callbackQuery.data.split('_')[1]);
  const { getKickstarter } = require('../../../db/helpers');
  const { sendKickstarterPromo } = require('../../scenes/kickstarters/util/kickstarterPromo');

  await ctx.answerCbQuery('Отправляю промо...');

  try {
    const kickstarterData = await getKickstarter(kickstarterId);
    if (!kickstarterData) {
      await ctx.reply('❌ Кикстартер не найден');
      return;
    }

    const result = await sendKickstarterPromo(ctx, kickstarterData, kickstarterId);
    
    if (result.success) {
      await ctx.reply(`✅ Промо-сообщение отправлено в группу (ID сообщения: ${result.messageId})`);
    } else {
      await ctx.reply(`❌ Ошибка отправки промо: ${result.error}`);
    }
  } catch (error) {
    console.error('Error resending promo:', error);
    await ctx.reply('❌ Ошибка при отправке промо');
  }
});

module.exports = Composer.compose([
  editName,
  editCreator,
  editPledge,
  editPrice,
  resendPromo
]);

