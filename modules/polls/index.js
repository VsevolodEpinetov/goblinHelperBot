const { Composer } = require('telegraf')

module.exports = Composer.compose([
  require('./commands/count'),
  require('./commands/add'),
  require('./commands/addByPlus'),
])