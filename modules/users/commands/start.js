const { Composer, Markup } = require('telegraf');
const util = require('../../util');
const { t } = require('../../../modules/i18n');
const SETTINGS = require('../../../settings.json');
const { getUser, getAllUsers } = require('../../db/helpers');

// Команда /start
module.exports = Composer.command('start', async (ctx) => {
  util.log(ctx);

  if (ctx.message.chat.id < 0) {
    await ctx.replyWithHTML(t('start.chatOnlyPrivate'))
    return;
  }

  const userId = ctx.message.from.id;
  ctx.deleteMessage(ctx.message.message_id)

  const IS_CLOSED = false; //TODO: move to settings

  // Get user data from database
  const userData = await getUser(userId);

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

    if (util.isSuperUser(userId)) {
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
          ]
        ])
      })
      return;
    }

    if (roles.indexOf('goblin') > -1 || roles.indexOf('admin') > -1 || roles.indexOf('adminPlus') > -1) {
      const message = util.getUserMessage(ctx, userData)
      let menu = util.getUserButtons(ctx, userData);

      if (roles.indexOf('polls') > -1) {
        menu = [
          [
            Markup.button.callback('Голосования', `adminPolls`),
          ],
          ...menu
        ]
      }

      await ctx.replyWithHTML(message, {
        ...Markup.inlineKeyboard(menu)
      });
      return;
    }
  }
});