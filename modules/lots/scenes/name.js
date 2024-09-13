const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const lotsUtils = require('../utils');
const util = require('../../util.js');

const lotSceneNameStage = new Scenes.BaseScene('LOT_SCENE_NAME_STAGE');

lotSceneNameStage.enter(async (ctx) => {
  await lotsUtils.updateLotCreationMessage(ctx, `Отлично, автора тоже запомнил! Теперь последний этап - название лота. Обычно это может быть название набора/проекта, ну либо что-то другое\n\n<b>Этап:</b> 🗒 название`);
});

lotSceneNameStage.on('text', async (ctx) => {
  ctx.session.lot.name = ctx.message.text;

  // Delete the old message and user message
  await ctx.deleteMessage(ctx.session.lot.messageID);
  await ctx.deleteMessage(ctx.message.message_id);

  let organizator = ctx.session.lot.whoCreated?.first_name + ' ' + ctx.session.lot.whoCreated?.last_name;
  if (ctx.session.lot.whoCreated.username) {
    organizator += ` (@${ctx.session.lot.whoCreated.username})`;
  }


  let lotID = ctx.globalSession.lots.length;

  const buttons = [
    [
      Markup.button.callback('✅ Присоединиться', `action-join-lot-${lotID}`),
      Markup.button.callback('🏃 Выйти', `action-leave-lot-${lotID}`)
    ],
    [
      Markup.button.callback('❌ Закрыть', `action-close-lot-${lotID}`),
      Markup.button.callback('🗑 Удалить', `action-close-lot-${lotID}`),
      //Markup.button.callback('✍️ Редактировать', `action-close-lot-${lotID}`)
    ]
  ];

  if (ctx.session.lot.photos.length < 2) {

    const nctx = await ctx.replyWithPhoto(ctx.session.lot.photos[0], {
      caption: lotsUtils.getLotCaption({
        author: ctx.session.lot.author,
        name: ctx.session.lot.name,
        link: ctx.session.lot.link,
        price: ctx.session.lot.price,
        currency: ctx.session.lot.currency,
        organizator: organizator,
        status: true,
        participants: ctx.session.lot.participants,
      }),
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons)
    });

    ctx.session.lot = {
      ...ctx.session.lot,
      messageID: nctx.message_id,
    };

  } else {
    
    const nctx = await ctx.replyWithMediaGroup(
      ctx.session.lot.photos.map((p, id) => {
        return {
          type: 'photo',
          media: p,
          caption: id === 0
            ? lotsUtils.getLotCaption({
              author: ctx.session.lot.author,
              name: ctx.session.lot.name,
              link: ctx.session.lot.link,
              price: ctx.session.lot.price,
              currency: ctx.session.lot.currency,
              organizator: organizator,
              status: true,
              participants: ctx.session.lot.participants,
            })
            : null,
          parse_mode: 'HTML'
        };
      })
    );

    const newctx = await ctx.reply('Действия к лоту выше 👆', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons),
    });

    ctx.session.lot = {
      ...ctx.session.lot,
      messageID: nctx[0].message_id,
      additionalMessageID: newctx.message_id,
    };

  }

  return ctx.scene.leave();
});

lotSceneNameStage.leave(async (ctx) => {
  if (!ctx.globalSession.lots) ctx.globalSession.lots = [];
  ctx.globalSession.lots.push(ctx.session.lot);
  ctx.session.lot = null;
});

module.exports = lotSceneNameStage;