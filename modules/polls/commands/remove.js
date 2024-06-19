const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util');

module.exports = Composer.command('rem', async (ctx) => {
  util.log(ctx);

  if (!util.isAdmin(ctx.message.from.id)) { 
    return; 
  }

  const studioName = ctx.message.text.split('/rem')[1].trim();
  if (!studioName) {
    const noStudioMessage = await ctx.reply('No studio name provided');
    setTimeout(() => {
      ctx.deleteMessage(noStudioMessage.message_id);
    }, 5000);
    return;
  }

  let copy = ctx.globalSession.studios.slice();

  // Проверка наличия студии
  const studioExists = copy.find(obj => obj.name === studioName);
  if (!studioExists) {
    const notFoundMessage = await ctx.reply(`Studio ${studioName} not found`);
    setTimeout(async () => {
      await ctx.deleteMessage(notFoundMessage.message_id);
    }, 5000);
    return;
  }

  copy = copy.filter(function(obj) {
    return obj.name !== studioName;
  });

  copy.sort((a, b) => a.name.localeCompare(b.name));

  ctx.globalSession.studios = copy;

  const removedMessage = await ctx.reply(`Removed ${studioName} and sorted`);
  setTimeout(async () => {
    await ctx.deleteMessage(removedMessage.message_id);
  }, 5000);
});