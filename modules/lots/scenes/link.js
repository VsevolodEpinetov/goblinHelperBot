const { Scenes, Markup } = require("telegraf");
const lotsUtils = require('../utils');
const SETTINGS = require('../../../settings.json')

const lotSceneLinkStage = new Scenes.BaseScene('LOT_SCENE_LINK_STAGE');

lotSceneLinkStage.enter(async (ctx) => {
  await lotsUtils.updateLotCreationMessage(ctx, `Стоимость лота записал, спасибо! Пришли описание лота, чтобы было понимание, что это такое. Можно ссылку, если оно понятно будет\n\n<b>Этап:</b> ✍️ описание\n\nℹ️ <i><b>Для информации:</b> краткость - сестра таланта! Если описание слишком большое, то всё может взорваться</i>`);
});

lotSceneLinkStage.on('text', async (ctx) => {
  ctx.session.lot.link = ctx.message.text;

  await ctx.deleteMessage(ctx.message.message_id);

  return ctx.scene.enter('LOT_SCENE_AUTHOR_STAGE');
});

module.exports = lotSceneLinkStage;
