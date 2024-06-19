const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.command('add', async (ctx) => {
  util.log(ctx)

  if (!util.isAdmin(ctx.message.from.id)) { 
    return; 
  }

  const messageText = ctx.message.text;

  const data = JSON.stringify(messageText).replaceAll('"', '').split('\\n');
  let studio = {
    name: "dummy",
    price: 0,
    mainLink: "google.com",
    bought: false
  }

  data.forEach((el) => {
    let type = 'name';
    let value = el.trim(); // Удаляем лишние пробелы
    if (el.indexOf('http') === 0) {
      type = 'mainLink';
    } else if (el.indexOf('$') === 0 || el.indexOf('€') === 0) {
      type = 'price';
      value = el.replaceAll('$', '').replaceAll('€', '');
      value = parseInt(value);
    }
    studio[type] = value;
  });
  
  let copy = ctx.globalSession.studios.slice();
  copy.push(studio);
  copy.sort((a, b) => a.name.localeCompare(b.name));
  ctx.globalSession.studios = copy;

  const addedMessage = await ctx.reply(`Added ${studio.name} and sorted`);
  setTimeout(async () => {
    await ctx.deleteMessage(addedMessage.message_id);
  }, 5000);
})