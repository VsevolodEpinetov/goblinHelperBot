const { Scenes, Markup } = require("telegraf");
const util = require('../../../util');

const currentStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_TAGS'
const nextStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_FILES'

const adminAddKickstarterTags = new Scenes.BaseScene(currentStageName);

adminAddKickstarterTags.enter(async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  await ctx.telegram.editMessageText(
    ctx.session.chatID,
    ctx.session.toEdit,
    undefined,
    `Пришли <b>теги</b> проекта. Теги НЕ ДОЛЖНЫ содержать "#" и должны быть разделены пробелами.`,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'cancelKickstarterAdd')]
      ])
    }
  );
});

adminAddKickstarterTags.action('cancelKickstarterAdd', async (ctx) => {
  ctx.session.kickstarter = null;
  await ctx.answerCbQuery('Отменено');
  await ctx.scene.leave();
  await ctx.reply('❌ Добавление кикстартера отменено');
});

adminAddKickstarterTags.on('text', async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  const data = ctx.message.text.split(' ');

  await ctx.deleteMessage(ctx.message.message_id);

  ctx.session.kickstarter.tags = data;

  ctx.scene.enter(nextStageName);
});

module.exports = adminAddKickstarterTags;