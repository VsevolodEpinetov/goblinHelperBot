const { Composer, Markup } = require('telegraf');
const lotsUtils = require('../utils')
const SETTINGS = require('../../../settings.json');

module.exports = Composer.command('infom', (ctx) => {
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) {
    return;
  }
})