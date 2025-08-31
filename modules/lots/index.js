const { Composer } = require('telegraf')

module.exports = Composer.compose([
  require('./commands/enter'),
  require('./commands/revive'),
  require('./commands/info'),
  require('./commands/infom'),
  require('./commands/upd'),
  require('./commands/nf'),
  require('./commands/preferences'),
  require('./commands/search'),
  require('./actions/leave'),
  require('./actions/join'),
  require('./actions/close'),
  // New streamlined scenes
  require('./scenes/photo'),
  require('./scenes/basicInfo'),
  require('./scenes/priceAndTags'),
  require('./scenes/review')
])