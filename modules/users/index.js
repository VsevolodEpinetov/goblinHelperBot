const { Composer } = require('telegraf')

module.exports = Composer.compose([
  require('./commands/start'),
  require('./actions/requestAddUser'),
  require('./actions/setRole')
])