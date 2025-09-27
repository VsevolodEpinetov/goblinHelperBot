const { getSuperUserMenu } = require('./superUserMenu');
const { getApprovedUserMenu, markInvitationUsed } = require('./approvedUserMenu');
const { getMainUserMenu } = require('./mainUserMenu');
const { getPreapprovedUserMenu } = require('./preapprovedUserMenu');
const { getPendingUserMenu } = require('./pendingUserMenu');
const { getRejectedUserMenu } = require('./rejectedUserMenu');
const { getBannedUserMenu } = require('./bannedUserMenu');
const { getSelfBannedUserMenu } = require('./selfBannedUserMenu');
const { getNewUserMenu } = require('./newUserMenu');
const { getDepartedMenu } = require('./alumniMenu');

module.exports = {
  getSuperUserMenu,
  getApprovedUserMenu,
  getMainUserMenu,
  getPreapprovedUserMenu,
  getPendingUserMenu,
  getRejectedUserMenu,
  getBannedUserMenu,
  getSelfBannedUserMenu,
  getNewUserMenu,
  getDepartedMenu,
  markInvitationUsed
};
