const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')
const { hasPermission } = require('../../rbac')
const { getUser } = require('../../db/helpers')
const knex = require('../../db/knex')

module.exports = Composer.command('add', async (ctx) => {
  util.log(ctx)

  // Check permissions using new RBAC system
  const userData = await getUser(ctx.message.from.id);
  if (!userData || !hasPermission(userData.roles, 'admin:polls:create')) {
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
  
  try {
    // Add studio to core studios table
    await knex('polls_core_studios').insert({
      name: studio.name,
      price: studio.price,
      is_active: true
    });

    const addedMessage = await ctx.reply(`Added ${studio.name} to core studios`);
    setTimeout(async () => {
      await ctx.deleteMessage(addedMessage.message_id);
    }, 5000);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      const errorMessage = await ctx.reply(`Studio ${studio.name} already exists in core studios`);
      setTimeout(async () => {
        await ctx.deleteMessage(errorMessage.message_id);
      }, 5000);
    } else {
      console.error('Error adding studio to core:', error);
      const errorMessage = await ctx.reply(`Error adding studio: ${error.message}`);
      setTimeout(async () => {
        await ctx.deleteMessage(errorMessage.message_id);
      }, 5000);
    }
  }
})