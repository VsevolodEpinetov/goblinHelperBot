const { Scenes, Markup } = require("telegraf");

const currentStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_LINK'
const nextStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_NAME'

const adminAddKickstarterLink = new Scenes.BaseScene(currentStageName);

adminAddKickstarterLink.enter(async (ctx) => {
  await ctx.replyWithHTML(`Пришли <b>ссылку</b> на проект`).then(nctx => {
    ctx.session.toEdit = nctx.message_id;
    ctx.session.chatID = nctx.chat.id;
  });
});

adminAddKickstarterLink.on('text', async (ctx) => {
  const link = ctx.message.text;

  await ctx.deleteMessage(ctx.message.message_id);

  ctx.session.kickstarter.link = link;

  ctx.scene.enter(nextStageName)
});

module.exports = adminAddKickstarterLink;
 