const { Composer } = require('telegraf')

module.exports = Composer.compose([
  require('./count'),
  require('./poll'),
  require('./studios'),
  require('./sync'),
  require('./switch')
])