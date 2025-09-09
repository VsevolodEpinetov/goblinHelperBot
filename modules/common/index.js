const { Composer } = require('telegraf')


// Debug handler to see if common module is being called
const debugHandler = new Composer();
debugHandler.use(async (ctx, next) => {
  return next();
});

module.exports = Composer.compose([
  debugHandler,
  require('./commands/id'),
  require('./commands/roll'),
  require('./commands/infoCommand'),
  require('./commands/test'),
  require('./actions/deleteThisMessage'),
])
