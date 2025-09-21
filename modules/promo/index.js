const { Composer } = require('telegraf');
const { getAllFilesFromFolder } = require('../util');
const path = require('path');

// Load all promo actions
const actions = getAllFilesFromFolder(path.join(__dirname, './actions'))
  .map(file => {
    try {
      return require(file);
    } catch (error) {
      console.error('❌ Failed to load promo action:', file, error.message);
      return null;
    }
  })
  .filter((m) => typeof m === 'function');

// Load all promo commands
const commands = getAllFilesFromFolder(path.join(__dirname, './commands'))
  .map(file => {
    try {
      return require(file);
    } catch (error) {
      console.error('❌ Failed to load promo command:', file, error.message);
      return null;
    }
  })
  .filter((m) => typeof m === 'function');

module.exports = Composer.compose([
  ...actions,
  ...commands
]);
