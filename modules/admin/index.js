const { Composer } = require('telegraf');
const { getAllFilesFromFolder } = require('../util');
const path = require('path');

const actions = getAllFilesFromFolder(path.join(__dirname, './actions'))
  .map(file => {
    try {
      return require(file);
    } catch (error) {
      console.log('❌ Error loading admin action file:', file, error.message);
      return null;
    }
  })
  .filter((m) => typeof m === 'function' || (m && typeof m === 'object' && m.constructor && m.constructor.name === 'Composer'));

const commands = getAllFilesFromFolder(path.join(__dirname, './commands'))
  .map(file => {
    try {
      return require(file);
    } catch (error) {
      console.log('❌ Error loading admin command file:', file, error.message);
      return null;
    }
  })
  .filter((m) => typeof m === 'function');

module.exports = Composer.compose([
  ...actions,
  ...commands
])