const { Composer } = require('telegraf')
module.exports = Composer.compose([
  require('./enter'),
  require('./scenes/photoScene')
])