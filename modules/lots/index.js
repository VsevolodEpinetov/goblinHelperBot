const { Composer } = require('telegraf')

module.exports = Composer.compose([
  require('./commands/enter'),
  require('./commands/revive'),
  require('./commands/info'),
  require('./actions/leave'),
  require('./actions/join'),
  require('./actions/close')
])