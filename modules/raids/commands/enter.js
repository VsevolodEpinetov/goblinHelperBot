const { Composer } = require('telegraf')
const SETTINGS = require('../../../settings.json');
const { ensureRoles } = require('../../rbac');

const RAID_CREATOR_ROLES = ['goblin', 'polls', 'adminPolls', 'protector', 'admin', 'adminPlus', 'super'];

module.exports = Composer.hears(/^[гГ]облины[,]? на рейд[!]?$/g, async (ctx, next) => {
  if (ctx.message.chat.type !== 'private') {
    return next();
  }
  
  const check = await ensureRoles(ctx, RAID_CREATOR_ROLES, { errorMessage: '❌ Создание рейдов доступно только участникам сообщества' });
  if (!check.allowed) return;

  await ctx.deleteMessage(ctx.message.message_id)
  ctx.scene.enter('RAID_SCENE_PHOTO_STAGE');
})
