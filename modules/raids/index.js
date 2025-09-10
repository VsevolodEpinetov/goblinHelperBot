const { Composer } = require('telegraf')


module.exports = Composer.compose([
  require('./actions/handlers'), // Move handlers first
  require('./commands/enter'),
  require('./commands/info'),
  require('./commands/list'),
  // Raid creation scenes
  require('./scenes/photo'),
  require('./scenes/link'),
  require('./scenes/price'),
  require('./scenes/description'),
  require('./scenes/date'),
  require('./scenes/review')
])
