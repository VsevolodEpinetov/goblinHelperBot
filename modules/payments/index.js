const { Composer } = require('telegraf')

module.exports = Composer.compose([
  require('./commands/thisis'),
  require('./commands/thisis-channel'),
  require('./stars'),
])