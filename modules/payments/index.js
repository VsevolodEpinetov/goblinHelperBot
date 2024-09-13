const { Composer } = require('telegraf')

module.exports = Composer.compose([
  require('./commands/payment'),
  require('./commands/months'),
  require('./commands/thisis'),
  require('./commands/thisis-channel'),
  require('./commands/resetm'),
  require('./commands/paymentadmin'),
  require('./commands/pi'),
  require('./commands/participants'),
  require('./actions/addMonth'),
  require('./actions/actionBaseGroup'),
  require('./actions/actionAdditional'),
  require('./actions/checkMonths'),
  require('./actions/checkMonth'),
  require('./actions/showNonPayers')
])