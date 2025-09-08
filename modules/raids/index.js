const { Composer } = require('telegraf')

console.log('📦 Loading raids module...');

// Debug handler to see if raids module is being called
const debugHandler = new Composer();
debugHandler.use(async (ctx, next) => {
  console.log('🔧 Raids module: Processing update...');
  if (ctx.callbackQuery) {
    console.log('🔧 Raids module: Callback query data:', ctx.callbackQuery.data);
  } else if (ctx.message) {
    console.log('🔧 Raids module: Message text:', ctx.message.text);
  }
  console.log('🔧 Raids module: Calling next()...');
  const result = await next();
  console.log('🔧 Raids module: next() returned:', result);
  return result;
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
