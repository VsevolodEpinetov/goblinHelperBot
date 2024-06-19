const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.command('rem', async (ctx) => {
  util.log(ctx)

  if (!util.isAdmin(ctx.message.from.id)) { 
    return; 
  }

  const studioName = ctx.message.text.split('/rem')[1].trim();
  if (!studioName) {
    ctx.reply('No studio name provided');
    return;
  }

  let copy = ctx.globalSession.studios.slice();

  copy = copy.filter(function( obj ) {
    return obj.name !== studioName;
  });

  copy.sort((a, b) => a.name.localeCompare(b.name))

  ctx.globalSession.studios = copy;

  ctx.reply('removed and sorted')
})