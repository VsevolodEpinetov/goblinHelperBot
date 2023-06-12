const { Composer } = require('telegraf')

module.exports = Composer.compose([
  require('./commands/enter'),
  require('./commands/revive'),
  require('./actions/join'),
  require('./actions/close')
])