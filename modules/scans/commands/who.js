const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.reaction('👍', async (ctx) => {
  if (
    ctx.update.message_reaction.user.id != SETTINGS.CHATS.EPINETOV
  ) { return; }
})