const { Scenes, Markup } = require("telegraf");
const util = require('../../../util');
const knex = require('../../../db/knex');

const editNameScene = new Scenes.BaseScene('ADMIN_SCENE_EDIT_KICKSTARTER_NAME');

editNameScene.enter(async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  const message = await ctx.replyWithHTML(
    `Пришли новое <b>название</b> кикстартера`,
    Markup.inlineKeyboard([
      [Markup.button.callback('❌ Отмена', 'cancelKickstarterEdit')]
    ])
  );
  ctx.session.toEdit = message.message_id;
  ctx.session.chatID = message.chat.id;
});

editNameScene.action('cancelKickstarterEdit', async (ctx) => {
  ctx.session.editingKickstarter = null;
  await ctx.answerCbQuery('Отменено');
  await ctx.scene.leave();
  await ctx.reply('❌ Редактирование отменено');
});

editNameScene.on('text', async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  const newName = ctx.message.text;
  const kickstarterId = ctx.session.editingKickstarter.id;

  await ctx.deleteMessage(ctx.message.message_id);

  try {
    await knex('kickstarters')
      .where('id', kickstarterId)
      .update({ name: newName });

    await ctx.telegram.editMessageText(
      ctx.session.chatID,
      ctx.session.toEdit,
      undefined,
      `✅ Название обновлено: <b>${newName}</b>`,
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
    console.error('Error updating kickstarter name:', error);
    await ctx.reply('❌ Ошибка при обновлении');
    await ctx.scene.leave();
  }
});

module.exports = editNameScene;

