const { Scenes, Markup } = require("telegraf");

const currentStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_PICTURES'
const nextStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_FILES'

const adminAddKickstarterPhotos = new Scenes.BaseScene(currentStageName);

adminAddKickstarterPhotos.enter(async (ctx) => {
  await ctx.telegram.editMessageText(ctx.session.chatID, ctx.session.toEdit, undefined, `Пришли <b>картинки</b> проекта`, {
    parse_mode: "HTML"
  });
});

adminAddKickstarterPhotos.on('photo', async (ctx) => {
  ctx.session.kickstarter.photos.push(ctx.message.photo[ctx.message.photo.length - 1].file_id);

  await ctx.deleteMessage(ctx.message.message_id);

  await ctx.telegram.editMessageText(ctx.session.chatID, ctx.session.toEdit, undefined, `Пришли <b>картинки</b> проекта\nКоличество картинок: ${ctx.session.kickstarter.photos.length}`, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      Markup.button.callback('Готово', 'finished')
    ])
  });
});

adminAddKickstarterPhotos.action('finished', async (ctx) => {
  ctx.scene.enter(nextStageName);
});

module.exports = adminAddKickstarterPhotos;