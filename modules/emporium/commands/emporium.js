const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util');

module.exports = Composer.command('emporium', (ctx) => {
  util.log(ctx);
  if (ctx.message.chat.id != SETTINGS.CHATS.EMPORIUM && ctx.message.from.id != SETTINGS.CHATS.EPINETOV) {
    return;
  }

  if (!ctx.globalSession.emporium) ctx.globalSession.emporium = {};
  if (!ctx.globalSession.emporium.studios) ctx.globalSession.emporium.studios = {};
  if (!ctx.globalSession.emporium.queue) ctx.globalSession.emporium.queue = [];
  ctx.scene.enter('EMPORIUM_TYPE_STAGE');
})