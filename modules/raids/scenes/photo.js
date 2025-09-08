const { Scenes, Markup } = require('telegraf');
const { initializeRaidSession, generateProgressBar, RAID_CREATION_STEPS, sendMessageWithCleanup } = require('../utils');

const photoScene = new Scenes.BaseScene('RAID_SCENE_PHOTO_STAGE');

photoScene.enter(async (ctx) => {
  initializeRaidSession(ctx);
  
  const progressBar = generateProgressBar(RAID_CREATION_STEPS.PHOTOS.step);
  
  const message = `🖼 <b>${RAID_CREATION_STEPS.PHOTOS.name}</b>\n\n` +
    `${RAID_CREATION_STEPS.PHOTOS.description}\n\n` +
    `📊 <b>Прогресс:</b> ${progressBar}\n\n` +
    `📸 <b>Загрузите фотографии рейда</b>\n\n` +
    `💡 <b>Советы:</b>\n` +
    `• Можно загрузить несколько фото\n` +
    `• Покажите товар с разных ракурсов\n` +
    `• Качество фото влияет на интерес к рейду\n\n` +
    `⏭ <b>Когда закончите, нажмите "Далее"</b>`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('⏭ Далее', 'raid_next_step')],
    [Markup.button.callback('❌ Отмена', 'raid_cancel')]
  ]);

  await sendMessageWithCleanup(ctx, message, keyboard);
});

photoScene.on('photo', async (ctx) => {
  if (!ctx.session.raid) {
    initializeRaidSession(ctx);
  }

  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  const fileId = photo.file_id;
  
  ctx.session.raid.photos.push({
    file_id: fileId,
    order_index: ctx.session.raid.photos.length
  });

  const photoCount = ctx.session.raid.photos.length;
  const progressBar = generateProgressBar(RAID_CREATION_STEPS.PHOTOS.step);
  
  const message = `📸 <b>Фото ${photoCount} добавлено!</b>\n\n` +
    `📊 <b>Прогресс:</b> ${progressBar}\n\n` +
    `🖼 <b>Загружено фото:</b> ${photoCount}\n\n` +
    `💡 <b>Можете загрузить еще или перейти к следующему шагу</b>`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('⏭ Далее', 'raid_next_step')],
    [Markup.button.callback('❌ Отмена', 'raid_cancel')]
  ]);

  await sendMessageWithCleanup(ctx, message, keyboard);
});

photoScene.action('raid_next_step', async (ctx) => {
  if (!ctx.session.raid || ctx.session.raid.photos.length === 0) {
    await ctx.answerCbQuery('❌ Сначала загрузите хотя бы одно фото!');
    return;
  }
  
  await ctx.answerCbQuery();
  ctx.scene.enter('RAID_SCENE_LINK_STAGE');
});

photoScene.action('raid_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  delete ctx.session.raid;
  await ctx.reply('❌ Создание рейда отменено');
  ctx.scene.leave();
});

photoScene.on('message', async (ctx, next) => {
  // Only handle messages if user is in this scene
  if (ctx.scene.session && ctx.scene.session.current === 'RAID_SCENE_PHOTO_STAGE') {
    await ctx.reply('📸 Пожалуйста, загрузите фото или используйте кнопки ниже');
  } else {
    return next();
  }
});

module.exports = photoScene;
