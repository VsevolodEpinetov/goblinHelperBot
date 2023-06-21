const { Composer } = require('telegraf')

module.exports = Composer.compose([
  require('./commands/emporium'),
  require('./commands/se'),
  require('./commands/rs'),
  require('./commands/nq'),
  require('./actions/publish'),
  require('./actions/changeBGAny'),
  require('./actions/changeBGRaces'),
  require('./actions/changeBGClasses'),
  require('./actions/sendToConfirmation')
])