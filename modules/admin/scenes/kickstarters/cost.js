const { Scenes, Markup } = require("telegraf");

const currentStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_COST'
const nextStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_TAGS'

const adminAddKickstarterCost = new Scenes.BaseScene(currentStageName);

adminAddKickstarterCost.enter(async (ctx) => {
  await ctx.telegram.editMessageText(ctx.session.chatID, ctx.session.toEdit, undefined, `Пришли <b>стоимость покупки</b> проекта`, {
    parse_mode: "HTML"
  });
});

adminAddKickstarterCost.on('text', async (ctx) => {
  const data = ctx.message.text;

  await ctx.deleteMessage(ctx.message.message_id);

  ctx.session.kickstarter.cost = data;

  ctx.scene.enter(nextStageName)
});

module.exports = adminAddKickstarterCost;
 