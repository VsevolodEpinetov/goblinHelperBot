const { Composer } = require('telegraf');
const { getAllFilesFromFolder } = require('../util');
const path = require('path');

const actions = getAllFilesFromFolder(path.join(__dirname, './actions'))
  .map(file => require(file));  // Импортируем файлы

const commands = getAllFilesFromFolder(path.join(__dirname, './commands'))
  .map(file => require(file));  // Импортируем файлы

module.exports = Composer.compose([
  ...actions,
  ...commands
])