const { Scenes, Markup } = require('telegraf');
const { generateProgressBar, RAID_CREATION_STEPS } = require('../utils');

const dateScene = new Scenes.BaseScene('RAID_SCENE_DATE_STAGE');

dateScene.enter(async (ctx) => {
  const progressBar = generateProgressBar(5);
  
  const message = `📅 <b>Дата окончания рейда</b>\n\n` +
    `📊 <b>Прогресс:</b> ${progressBar}\n\n` +
    `⏰ <b>Укажите приблизительную дату окончания рейда</b>\n\n` +
    `💡 <b>Формат:</b> ДД.ММ.ГГГГ или ДД.ММ\n` +
    `• 15.12.2024\n` +
    `• 20.12\n` +
    `• 25 декабря\n\n` +
    `⚠️ <b>Важно:</b> После этой даты рейд будет закрыт для новых участников`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('⏭ Пропустить', 'raid_skip_date')],
    [Markup.button.callback('🔙 Назад', 'raid_prev_step')],
    [Markup.button.callback('❌ Отмена', 'raid_cancel')]
  ]);

  await ctx.reply(message, {
    parse_mode: 'HTML',
    ...keyboard
  });
});

dateScene.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  
  // Parse date in various formats
  let parsedDate = null;
  
  // Try DD.MM.YYYY format
  const ddmmyyyy = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    parsedDate = new Date(year, month - 1, day);
  }
  
  // Try DD.MM format (assume current year)
  const ddmm = text.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (ddmm && !parsedDate) {
    const [, day, month] = ddmm;
    const currentYear = new Date().getFullYear();
    parsedDate = new Date(currentYear, month - 1, day);
  }
  
  // Try Russian month names
  const russianMonths = {
    'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3,
    'мая': 4, 'июня': 5, 'июля': 6, 'августа': 7,
    'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
  };
  
  const russianDate = text.match(/^(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?$/);
  if (russianDate && !parsedDate) {
    const [, day, monthName, year] = russianDate;
    const month = russianMonths[monthName.toLowerCase()];
    if (month !== undefined) {
      const targetYear = year ? parseInt(year) : new Date().getFullYear();
      parsedDate = new Date(targetYear, month, parseInt(day));
    }
  }
  
  if (!parsedDate || isNaN(parsedDate.getTime())) {
    await ctx.reply('❌ Неверный формат даты! Используйте формат: "15.12.2024" или "20 декабря"');
    return;
  }
  
  // Check if date is in the future
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  parsedDate.setHours(0, 0, 0, 0);
  
  if (parsedDate <= now) {
    await ctx.reply('❌ Дата должна быть в будущем!');
    return;
  }

  ctx.session.raid.endDate = parsedDate.toISOString();
  
  const progressBar = generateProgressBar(5);
  const formattedDate = parsedDate.toLocaleDateString('ru-RU');
  
  const message = `✅ <b>Дата сохранена!</b>\n\n` +
    `📊 <b>Прогресс:</b> ${progressBar}\n\n` +
    `📅 <b>Дата окончания:</b> ${formattedDate}\n\n` +
    `⏭ <b>Переходим к финальному шагу</b>`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('⏭ Далее', 'raid_next_step')],
    [Markup.button.callback('🔙 Назад', 'raid_prev_step')],
    [Markup.button.callback('❌ Отмена', 'raid_cancel')]
  ]);

  await ctx.reply(message, {
    parse_mode: 'HTML',
    ...keyboard
  });
});

dateScene.action('raid_skip_date', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.raid.endDate = null;
  
  const progressBar = generateProgressBar(5);
  
  const message = `⏭ <b>Дата пропущена</b>\n\n` +
    `📊 <b>Прогресс:</b> ${progressBar}\n\n` +
    `⏭ <b>Переходим к финальному шагу</b>`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('⏭ Далее', 'raid_next_step')],
    [Markup.button.callback('🔙 Назад', 'raid_prev_step')],
    [Markup.button.callback('❌ Отмена', 'raid_cancel')]
  ]);

  await ctx.reply(message, {
    parse_mode: 'HTML',
    ...keyboard
  });
});

dateScene.action('raid_next_step', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.enter('RAID_SCENE_REVIEW_STAGE');
});

dateScene.action('raid_prev_step', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.enter('RAID_SCENE_DESCRIPTION_STAGE');
});

dateScene.action('raid_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  delete ctx.session.raid;
  await ctx.reply('❌ Создание рейда отменено');
  ctx.scene.leave();
});

dateScene.on('message', async (ctx, next) => {
  // Only handle messages if user is in this scene
  if (ctx.scene.session && ctx.scene.session.current === 'RAID_SCENE_DATE_STAGE') {
    await ctx.reply('📅 Пожалуйста, укажите дату в формате "15.12.2024" или используйте кнопки ниже');
  } else {
    return next();
  }
});

module.exports = dateScene;
