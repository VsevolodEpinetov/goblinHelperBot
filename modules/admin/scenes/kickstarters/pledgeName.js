const { Scenes, Markup } = require("telegraf");

const currentStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_PLEDGE_NAME'
const nextStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_PLEDGE_COST'

const adminAddKickstarterPledgeName = new Scenes.BaseScene(currentStageName);

adminAddKickstarterPledgeName.enter(async (ctx) => {
  await ctx.telegram.editMessageText(ctx.session.chatID, ctx.session.toEdit, undefined, `Пришли <b>название пледжа</b> проекта`, {
    parse_mode: "HTML"
  });
});

adminAddKickstarterPledgeName.on('text', async (ctx) => {
  const data = ctx.message.text;

  await ctx.deleteMessage(ctx.message.message_id);

  ctx.session.kickstarter.pledgeName = data;

  ctx.scene.enter(nextStageName)
});

module.exports = adminAddKickstarterPledgeName;
 