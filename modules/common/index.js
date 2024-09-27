const { Composer } = require('telegraf')

module.exports = Composer.compose([
  require('./commands/id'),
  require('./commands/roll'),
  require('./actions/deleteThisMessage'),
])
