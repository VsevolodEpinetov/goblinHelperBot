const { Scenes, Markup } = require("telegraf");
const lotsUtils = require('../utils');
const SETTINGS = require('../../../settings.json')

const lotSceneAuthorStage = new Scenes.BaseScene('LOT_SCENE_AUTHOR_STAGE');

lotSceneAuthorStage.enter(async (ctx) => {
  await lotsUtils.updateLotCreationMessage(ctx, `Описание записал. А теперь - автор моделек, миниатюрок или в принципе того, что выкупаем\n\n<b>Этап:</b> 👨‍🎨 автор`);
});

lotSceneAuthorStage.on('text', async (ctx) => {
  ctx.session.lot.author = ctx.message.text;

  await ctx.deleteMessage(ctx.message.message_id);

  return ctx.scene.enter('LOT_SCENE_NAME_STAGE');
});

module.exports = lotSceneAuthorStage;
