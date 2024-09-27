const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action('adminAddKickstarter', async (ctx) => {
  ctx.session.kickstarter = {
    name: '',
    creator: '',
    link: [],
    files: [],
    pledgeCost: 0,
    cost: 0,
    tags: [],
    photos: [],
    pledgeName: ''
  }
  await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  ctx.scene.enter('ADMIN_SCENE_ADD_KICKSTARTER_LINK');
});