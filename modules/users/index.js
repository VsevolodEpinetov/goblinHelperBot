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
  .filter((m) => typeof m === 'function');  // Ensure only middlewares

const commands = getAllFilesFromFolder(path.join(__dirname, './commands'))
  .map(file => {
    try {
      return require(file);
    } catch (error) {
      console.error('❌ Failed to load command:', file, error.message);
      return null;
    }
  })
  .filter((m) => typeof m === 'function');  // Ensure only middlewares


// Import all new enhanced UX actions (safely)
const enhancedActionPaths = [
  './actions/refreshUserStatus',
  './actions/userHelp',
  './actions/detailedHelp',
  './actions/userBalanceScrolls',
  './actions/userStats',
  './actions/addPlusToCurrentMonth',
  './actions/useScroll',
  './actions/contactSupport',
  './actions/showFAQ',
  './actions/applyInit',
  './actions/startApplication',
  './actions/applicationQuestions',
  './actions/showRules',
  './actions/whatIsIt',
  './actions/readyToParticipate',
  './actions/confirmParticipation',
  './actions/cancelParticipation',
  './actions/confirmGroupJoin',
  './actions/groupJoinHandler',
  './actions/joinRequestHandler',
  './actions/payCurrentMonth',
  './actions/payRegularMonth',
  './actions/payPlusMonth',
  './actions/paySbpMonth',
  './actions/paymentSuccess',
  './actions/joinArchive',
  './actions/linkNotWorking',
  './actions/userProfile',
  './actions/userScrolls',
  './actions/userRaids',
  './actions/createRaid',
  './actions/userKickstarters',
  './actions/oldMonthsMenu',
  './actions/oldMonthsYear',
  './actions/oldMonthsMonth',
  './actions/oldMonthsJoin',
  './actions/oldMonthsBuy',
  './actions/oldMonthsBuyCompat',
  './actions/adminMenu',
  './actions/months/menu',
  './actions/kickstarter/menu',
  // Raid management actions
  './actions/userCreatedRaids',
  './actions/userParticipatedRaids',
  './actions/manageRaid',
  './actions/editRaid',
  './actions/editRaidTitle',
  './actions/editRaidDescription',
  './actions/editRaidLink',
  './actions/editRaidPrice',
  './actions/editRaidDate',
  './actions/processRaidEdit',
  './actions/raidParticipants',
  './actions/excludeParticipant',
  './actions/viewRaid',
  './actions/closeRaid'
];

const enhancedActions = enhancedActionPaths
  .map(p => {
    try { return require(p); } catch (error) {
      console.error('❌ Failed to load enhanced action:', p, error.message);
      return null;
    }
  })
  .filter((m) => typeof m === 'function');


const composer = Composer.compose([
  ...actions,
  ...commands,
  ...enhancedActions
]);

// Users module loaded

module.exports = composer;