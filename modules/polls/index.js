const { Composer } = require('telegraf')

module.exports = Composer.compose([
  require('./commands/count'),
  require('./commands/poll'),
  require('./commands/studios'),
  require('./commands/sync'),
  require('./commands/switch'),
  require('./commands/add'),
  require('./commands/addByPlus'),
])