const { Composer } = require('telegraf')


// Debug handler to see if raids module is being called
const debugHandler = new Composer();
debugHandler.use(async (ctx, next) => {
  return await next();
});

module.exports = Composer.compose([
  debugHandler,
  require('./actions/handlers'), // Move handlers first
  require('./commands/enter'),
  require('./commands/info'),
  require('./commands/list'),
  // Raid creation scenes
  require('./scenes/photo'),
  require('./scenes/link'),
  require('./scenes/price'),
  require('./scenes/description'),
  require('./scenes/date'),
  require('./scenes/review')
])
