const { Composer, Markup } = require('telegraf');
const util = require('../../util');
const { t } = require('../../../modules/i18n');
const SETTINGS = require('../../../settings.json');
const { getUser, getAllUsers } = require('../../db/helpers');

// Команда /start
module.exports = Composer.command('start', async (ctx) => {
  console.log('🎯 START command received!');
  console.log('👤 User:', {
    id: ctx.message?.from?.id,
    username: ctx.message?.from?.username,
    firstName: ctx.message?.from?.first_name
  });
  console.log('💬 Chat:', {
    id: ctx.message?.chat?.id,
    type: ctx.message?.chat?.type
  });
  
  util.log(ctx);

  if (ctx.message.chat.id < 0) {
    await ctx.replyWithHTML(t('start.chatOnlyPrivate'))
    return;
  }

  const userId = ctx.message.from.id;
  ctx.deleteMessage()

  const IS_CLOSED = false; //TODO: move to settings

  // Get user data from database
  console.log('🔍 Fetching user data for ID:', userId);
  const userData = await getUser(userId);
  console.log('📊 User data:', userData ? {
    id: userData.id,
    username: userData.username,
    roles: userData.roles,
    hasPurchases: !!userData.purchases
  } : 'null');

  console.log('🎭 Role analysis:');
  console.log('  - User roles:', userData?.roles || []);
  console.log('  - Expected roles for super user: [super]');
  console.log('  - Expected roles for goblin/admin: [goblin, admin, adminPlus]');

  if (!userData) {
    if (!IS_CLOSED) {
      await ctx.replyWithHTML(
        t('start.welcome'), {
        ...Markup.inlineKeyboard([
          [Markup.button.callback(t('start.buttons.rules'), 'showRules')],
          [Markup.button.callback(t('start.buttons.apply'), 'applyInit')],
          [Markup.button.callback(t('start.buttons.whatIs'), 'showWhatIs')]
        ])
      }
      );
    } else {
      await ctx.reply(t('start.closed'))
    }
  } else {
    const roles = userData.roles;

    if (roles.length == 0) {
      await ctx.replyWithHTML(t('start.pending'))
      return;
    }

    if (roles.indexOf('rejected') > -1) {
      await ctx.replyWithHTML(t('start.rejected'))
      return;
    }

    console.log('🔍 Checking if user is super user...');
    console.log('  - User ID:', userId);
    console.log('  - EPINETOV ID from settings:', SETTINGS.CHATS.EPINETOV);
    console.log('  - ANN ID from settings:', SETTINGS.CHATS.ANN);
    console.log('  - Is super user:', util.isSuperUser(userId));
    
    if (util.isSuperUser(userId)) {
      console.log('👑 User is super user, showing admin menu');
      await ctx.replyWithHTML(t('start.menuSelect'), {
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('Месяцы', 'adminMonths'),
            Markup.button.callback('Месяцы Плюс', 'adminMonthsPlus')
          ],
          [
            Markup.button.callback('Кикстартеры', 'adminKickstarters'),
            Markup.button.callback('Релизы', 'adminReleases')
          ],
          [
            Markup.button.callback('Люди', 'adminParticipants'),
            Markup.button.callback('Голосования', 'adminPolls'),
          ],
          [
            Markup.button.callback('📋 Заявки на собеседование', 'adminPendingApplications'),
            Markup.button.callback('📊 Все заявки', 'adminAllApplications')
          ]
        ])
      })
      return;
    }

    console.log('🔍 Checking user roles:', roles);
    if (roles.indexOf('goblin') > -1 || roles.indexOf('admin') > -1 || roles.indexOf('adminPlus') > -1) {
      console.log('👤 User has goblin/admin role, showing interactive menu');
      // Use new enhanced UX system
      const interactiveMenu = util.createInteractiveMenu(ctx, userData);
      
      await ctx.replyWithHTML(interactiveMenu.message, {
        ...Markup.inlineKeyboard(interactiveMenu.keyboard)
      });
      return;
    }
  }
});