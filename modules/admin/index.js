const { Composer } = require('telegraf')

module.exports = Composer.compose([
  require('./actions/adminMenu'),
  require('./actions/adminMonths'),
  require('./actions/monthsAddYear'),
  require('./actions/monthsAdd'),
  require('./actions/adminAddLink'),
  require('./actions/adminAddLinkPlus'),
  require('./actions/adminAddKickstarter'),
  require('./actions/adminKickstarters'),
  require('./actions/searchKickstarter'),
  require('./actions/showKickstarter'),
])
