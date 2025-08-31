const { Composer } = require('telegraf');
const { getAllFilesFromFolder } = require('../util');
const path = require('path');

console.log('🔧 Loading users module...');

const actions = getAllFilesFromFolder(path.join(__dirname, './actions'))
  .map(file => require(file));  // Импортируем файлы

const commands = getAllFilesFromFolder(path.join(__dirname, './commands'))
  .map(file => require(file));  // Импортируем файлы

console.log('📁 Users module - Actions loaded:', actions.length);
console.log('📁 Users module - Commands loaded:', commands.length);

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
  require('./actions/startApplication'),
  require('./actions/applicationQuestions'),
  require('./actions/showRules'),
  require('./actions/showWhatIs'),
  require('./actions/months/menu'),
  require('./actions/kickstarter/menu')
];

console.log('📁 Users module - Enhanced actions loaded:', enhancedActions.length);

const composer = Composer.compose([
  ...actions,
  ...commands,
  ...enhancedActions
]);

console.log('📁 Users module - Total handlers:', actions.length + commands.length + enhancedActions.length);
console.log('✅ Users module loaded successfully');

module.exports = composer;