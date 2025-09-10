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
  .filter(Boolean);

const commands = getAllFilesFromFolder(path.join(__dirname, './commands'))
  .map(file => {
    try {
      return require(file);
    } catch (error) {
      console.log('❌ Error loading admin command file:', file, error.message);
      return null;
    }
  })
  .filter(Boolean);

module.exports = Composer.compose([
  ...actions,
  ...commands
])