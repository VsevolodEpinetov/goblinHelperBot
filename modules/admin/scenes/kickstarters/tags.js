const { Scenes, Markup } = require("telegraf");

const currentStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_TAGS'
const nextStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_PICTURES'

const adminAddKickstarterTags = new Scenes.BaseScene(currentStageName);

adminAddKickstarterTags.enter(async (ctx) => {
  await ctx.telegram.editMessageText(ctx.session.chatID, ctx.session.toEdit, undefined, `Пришли <b>теги</b> проекта`, {
    parse_mode: "HTML"
  });
});

adminAddKickstarterTags.on('text', async (ctx) => {
  const data = ctx.message.text.split(' ');

  await ctx.deleteMessage(ctx.message.message_id);

  ctx.session.kickstarter.tags = data;

  ctx.scene.enter(nextStageName)
});

module.exports = adminAddKickstarterTags;