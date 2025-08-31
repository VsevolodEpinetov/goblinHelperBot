const { Composer } = require('telegraf');
const { getAllFilesFromFolder } = require('../util');
const path = require('path');

const actions = getAllFilesFromFolder(path.join(__dirname, './actions'))
  .map(file => require(file));  // Импортируем файлы

const commands = getAllFilesFromFolder(path.join(__dirname, './commands'))
  .map(file => require(file));  // Импортируем файлы

// Import all new enhanced UX actions
const enhancedActions = [
  require('./actions/refreshUserStatus'),
  require('./actions/userHelp'),
  require('./actions/detailedHelp'),
  require('./actions/userBalanceTickets'),
  require('./actions/userStats'),
  require('./actions/addPlusToCurrentMonth'),
  require('./actions/useTicket'),
  require('./actions/contactSupport'),
  require('./actions/showFAQ'),
  require('./actions/applyInit'),
  require('./actions/showRules'),
  require('./actions/showWhatIs'),
  require('./actions/months/menu'),
  require('./actions/kickstarter/menu')
];

module.exports = Composer.compose([
  ...actions,
  ...commands,
  ...enhancedActions
])