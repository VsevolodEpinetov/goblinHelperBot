const { Composer } = require('telegraf');
const { getAllFilesFromFolder } = require('../util');
const path = require('path');

const actions = getAllFilesFromFolder(path.join(__dirname, './actions'))
  .map(file => {
    try {
      console.log('📄 Loading admin action file:', file);
      return require(file);
    } catch (error) {
      console.log('❌ Error loading admin action file:', file, error.message);
      return null;
    }
  })
  .filter(Boolean);

const commands = getAllFilesFromFolder(path.join(__dirname, './commands'))
  .map(file => {
    try {
      console.log('📄 Loading admin command file:', file);
      return require(file);
    } catch (error) {
      console.log('❌ Error loading admin command file:', file, error.message);
      return null;
    }
  })
  .filter(Boolean);

// Debug handler to catch all admin actions
const debugHandler = new Composer();
debugHandler.use(async (ctx, next) => {
  if (ctx.callbackQuery) {
    console.log('🔧 Admin module: Callback query received:', ctx.callbackQuery.data);
  }
  return next();
});

module.exports = Composer.compose([
  debugHandler,
  ...actions,
  ...commands
])