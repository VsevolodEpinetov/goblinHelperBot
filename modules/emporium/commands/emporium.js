const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')

module.exports = Composer.command('emporium', (ctx) => {
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) {return;}
  ctx.scene.enter('EMPORIUM_TYPE_STAGE');
})