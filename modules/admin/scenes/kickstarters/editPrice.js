const { Scenes, Markup } = require("telegraf");
const util = require('../../../util');
const { updateKickstarterPrice } = require('../../../db/helpers');

const editPriceScene = new Scenes.BaseScene('ADMIN_SCENE_EDIT_KICKSTARTER_PRICE');

editPriceScene.enter(async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  const message = await ctx.replyWithHTML(
    `Пришли новую <b>цену</b> в Telegram Stars`,
    Markup.inlineKeyboard([
      [Markup.button.callback('❌ Отмена', 'cancelKickstarterEdit')]
    ])
  );
  ctx.session.toEdit = message.message_id;
  ctx.session.chatID = message.chat.id;
});

editPriceScene.action('cancelKickstarterEdit', async (ctx) => {
  ctx.session.editingKickstarter = null;
  await ctx.answerCbQuery('Отменено');
  await ctx.scene.leave();
  await ctx.reply('❌ Редактирование отменено');
});

editPriceScene.on('text', async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  const newPrice = parseInt(ctx.message.text);
  if (isNaN(newPrice) || newPrice <= 0) {
    await ctx.reply('❌ Пожалуйста, введи корректное число (стоимость в Telegram Stars)');
    return;
  }

  const kickstarterId = ctx.session.editingKickstarter.id;

  await ctx.deleteMessage(ctx.message.message_id);

  try {
    await updateKickstarterPrice(kickstarterId, newPrice);

    await ctx.telegram.editMessageText(
      ctx.session.chatID,
      ctx.session.toEdit,
      undefined,
      `✅ Цена обновлена: <b>${newPrice} ⭐</b>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'adminKickstarters')]
        ])
      }
    );

    ctx.session.editingKickstarter = null;
    await ctx.scene.leave();
  } catch (error) {
    console.error('Error updating kickstarter price:', error);
    await ctx.reply('❌ Ошибка при обновлении');
    await ctx.scene.leave();
  }
});

module.exports = editPriceScene;

