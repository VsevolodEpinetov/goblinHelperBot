const { Scenes, Markup } = require("telegraf");

const currentStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_NAME'
const nextStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_CREATOR'

const adminAddKickstarterName = new Scenes.BaseScene(currentStageName);

adminAddKickstarterName.enter(async (ctx) => {
  await ctx.telegram.editMessageText(ctx.session.chatID, ctx.session.toEdit, undefined, `Пришли <b>название</b> проекта`, {
    parse_mode: "HTML"
  });
});

adminAddKickstarterName.on('text', async (ctx) => {
  const data = ctx.message.text;

  await ctx.deleteMessage(ctx.message.message_id);

  ctx.session.kickstarter.name = data;

  ctx.scene.enter(nextStageName)
});

module.exports = adminAddKickstarterName;
 