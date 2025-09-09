const { Composer } = require('telegraf');
const { getAllFilesFromFolder } = require('../util');
const path = require('path');


const actions = getAllFilesFromFolder(path.join(__dirname, './actions'))
  .map(file => {
    try {
      return require(file);
    } catch (error) {
      console.error('❌ Failed to load action:', file, error.message);
      return null;
    }
  })
  .filter(Boolean);  // Импортируем файлы

const commands = getAllFilesFromFolder(path.join(__dirname, './commands'))
  .map(file => {
    try {
      return require(file);
    } catch (error) {
      console.error('❌ Failed to load command:', file, error.message);
      return null;
    }
  })
  .filter(Boolean);  // Импортируем файлы


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


// Debug: Add a catch-all handler to see if the module is being called
const debugHandler = new Composer();
debugHandler.use(async (ctx, next) => {
  return await next();
});


const composer = Composer.compose([
  debugHandler,
  ...actions,
  ...commands,
  ...enhancedActions
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