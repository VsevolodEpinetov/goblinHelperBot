const { Composer } = require('telegraf');

module.exports = new Composer()
  .command('test', async (ctx) => {
    console.log('🧪 /test command received');
    await ctx.reply('Test command works!');
  });
