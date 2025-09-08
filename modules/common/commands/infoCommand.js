const { Composer } = require('telegraf');
const infoHandler = require('./info');

module.exports = new Composer()
  .command('debug', async (ctx) => {
    console.log('🔍 /debug command received in infoCommand.js');
    return infoHandler(ctx);
  });
