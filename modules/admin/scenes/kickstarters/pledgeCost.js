const { Scenes, Markup } = require("telegraf");

const currentStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_PLEDGE_COST'
const nextStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_COST'

const adminAddKickstarterPledgeCost = new Scenes.BaseScene(currentStageName);

adminAddKickstarterPledgeCost.enter(async (ctx) => {
  await ctx.telegram.editMessageText(ctx.session.chatID, ctx.session.toEdit, undefined, `Пришли <b>оригинальную стоимость пледжа</b> проекта`, {
    parse_mode: "HTML"
  });
});

adminAddKickstarterPledgeCost.on('text', async (ctx) => {
  const data = ctx.message.text;

  await ctx.deleteMessage(ctx.message.message_id);

  ctx.session.kickstarter.pledgeCost = data;

  ctx.scene.enter(nextStageName)
});

module.exports = adminAddKickstarterPledgeCost;
 