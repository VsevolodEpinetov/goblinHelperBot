const { Composer } = require('telegraf')

console.log('📦 Loading common module...');

// Debug handler to see if common module is being called
const debugHandler = new Composer();
debugHandler.use(async (ctx, next) => {
  console.log('🔧 Common module: Processing update...');
  console.log('🔧 Common module: Message text:', ctx.message?.text);
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
