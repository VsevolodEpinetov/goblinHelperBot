const { Composer } = require('telegraf');
const { getAllFilesFromFolder } = require('../util');
const path = require('path');

console.log('🔧 Loading users module...');

const actions = getAllFilesFromFolder(path.join(__dirname, './actions'))
  .map(file => {
    try {
      console.log('📄 Loading action file:', file);
      return require(file);
    } catch (error) {
      console.log('❌ Error loading action file:', file, error.message);
      return null;
    }
  })
  .filter(Boolean);  // Импортируем файлы

const commands = getAllFilesFromFolder(path.join(__dirname, './commands'))
  .map(file => {
    try {
      console.log('📄 Loading command file:', file);
      return require(file);
    } catch (error) {
      console.log('❌ Error loading command file:', file, error.message);
      return null;
    }
  })
  .filter(Boolean);  // Импортируем файлы

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
  require('./actions/whatIsIt'),
  require('./actions/readyToParticipate'),
  require('./actions/confirmParticipation'),
  require('./actions/cancelParticipation'),
  require('./actions/confirmGroupJoin'),
  require('./actions/groupJoinHandler'),
  require('./actions/joinRequestHandler'),
  require('./actions/payCurrentMonth'),
  require('./actions/payRegularMonth'),
  require('./actions/payPlusMonth'),
  require('./actions/paymentSuccess'),
  require('./actions/joinArchive'),
  require('./actions/linkNotWorking'),
  require('./actions/userProfile'),
  require('./actions/userTickets'),
  require('./actions/userRaids'),
  require('./actions/createRaid'),
  require('./actions/userKickstarters'),
  require('./actions/oldMonthsMenu'),
  require('./actions/adminMenu'),
  require('./actions/months/menu'),
  require('./actions/kickstarter/menu'),
  // Raid management actions
  require('./actions/userCreatedRaids'),
  require('./actions/userParticipatedRaids'),
  require('./actions/manageRaid'),
  require('./actions/editRaid'),
  require('./actions/editRaidTitle'),
  require('./actions/editRaidDescription'),
  require('./actions/editRaidLink'),
  require('./actions/editRaidPrice'),
  require('./actions/editRaidDate'),
  require('./actions/processRaidEdit'),
  require('./actions/raidParticipants'),
  require('./actions/excludeParticipant'),
  require('./actions/viewRaid'),
  require('./actions/closeRaid')
];

console.log('📁 Users module - Enhanced actions loaded:', enhancedActions.length);

// Debug: Add a catch-all handler to see if the module is being called
const debugHandler = new Composer();
debugHandler.use(async (ctx, next) => {
  console.log('🔧 Users module: Processing update...');
  console.log('🔧 Users module: Message text:', ctx.message?.text);
  console.log('🔧 Users module: Is command:', ctx.message?.text?.startsWith('/'));
  const result = await next();
  console.log('🔧 Users module: next() returned:', result);
  return result;
});

// Debug: Add a final handler to see if next() is being called
const finalHandler = new Composer();
finalHandler.use(async (ctx, next) => {
  console.log('🔧 Users module: Final handler - calling next()');
  return next();
});

const composer = Composer.compose([
  debugHandler,
  ...actions,
  ...commands,
  ...enhancedActions,
  finalHandler
]);

console.log('📁 Users module - Total handlers:', actions.length + commands.length + enhancedActions.length);

// Debug: Check if start command is loaded
console.log('🔍 All commands loaded:', commands.length);
console.log('🔍 Commands:', commands.map(cmd => cmd ? 'loaded' : 'null'));

// Test if the command actually works
if (commands.length > 0) {
  console.log('🔍 First command type:', typeof commands[0]);
  console.log('🔍 First command constructor:', commands[0]?.constructor?.name);
}

console.log('✅ Users module loaded successfully');

module.exports = composer;