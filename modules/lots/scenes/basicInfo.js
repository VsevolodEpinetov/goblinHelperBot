const { Scenes, Markup } = require("telegraf");
const lotsUtils = require('../utils');
const SETTINGS = require('../../../settings.json')

const lotSceneBasicInfoStage = new Scenes.BaseScene('LOT_SCENE_BASIC_INFO_STAGE');

lotSceneBasicInfoStage.enter(async (ctx) => {
  ctx.session.lot.currentStep = 2;
  await lotsUtils.updateLotCreationMessage(ctx,
    `Отлично! Теперь заполните основную информацию о лоте.\n\n` +
    `📝 <b>Название лота</b> - краткое и понятное название\n` +
    `✍️ <b>Описание</b> - что это такое, можно ссылку\n` +
    `👨‍🎨 <b>Автор</b> - кто создал/произвел\n\n` +
    `<i>Отправьте сообщение в формате:</i>\n` +
    `<code>Название|Описание|Автор</code>\n\n` +
    `<i>Или отправляйте по одному полю, начиная с названия</i>`,
    [
      Markup.button.callback('❌ Отмена', 'actionStopLot'),
      Markup.button.callback('⏭️ Пропустить', 'skipBasicInfo')
    ],
    2
  );
});

lotSceneBasicInfoStage.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  await ctx.deleteMessage(ctx.message.message_id);

  // Check if it's a combined format (title|description|author)
  if (text.includes('|')) {
    const parts = text.split('|').map(part => part.trim());
    
    if (parts.length >= 3) {
      ctx.session.lot.name = parts[0];
      ctx.session.lot.link = parts[1];
      ctx.session.lot.author = parts[2];
      
      await lotsUtils.updateLotCreationMessage(ctx,
        `✅ Основная информация заполнена!\n\n` +
        `📝 <b>Название:</b> ${ctx.session.lot.name}\n` +
        `✍️ <b>Описание:</b> ${ctx.session.lot.link}\n` +
        `👨‍🎨 <b>Автор:</b> ${ctx.session.lot.author}\n\n` +
        `Переходим к следующему этапу...`,
        [
          Markup.button.callback('❌ Отмена', 'actionStopLot')
        ],
        2
      );
      
      // Wait a moment then move to next stage
      setTimeout(() => {
        ctx.scene.enter('LOT_SCENE_PRICE_AND_TAGS_STAGE');
      }, 2000);
      
      return;
    }
  }

  // Handle single field input
  if (!ctx.session.lot.name) {
    ctx.session.lot.name = text;
    await lotsUtils.updateLotCreationMessage(ctx,
      `✅ Название: <b>${text}</b>\n\n` +
      `Теперь отправьте описание лота:`,
      [
        Markup.button.callback('❌ Отмена', 'actionStopLot'),
        Markup.button.callback('⏭️ Пропустить', 'skipBasicInfo')
      ],
      2
    );
  } else if (!ctx.session.lot.link) {
    ctx.session.lot.link = text;
    await lotsUtils.updateLotCreationMessage(ctx,
      `✅ Название: <b>${ctx.session.lot.name}</b>\n` +
      `✅ Описание: <b>${text}</b>\n\n` +
      `Теперь отправьте автора:`,
      [
        Markup.button.callback('❌ Отмена', 'actionStopLot'),
        Markup.button.callback('⏭️ Пропустить', 'skipBasicInfo')
      ],
      2
    );
  } else if (!ctx.session.lot.author) {
    ctx.session.lot.author = text;
    await lotsUtils.updateLotCreationMessage(ctx,
      `✅ Основная информация заполнена!\n\n` +
      `📝 <b>Название:</b> ${ctx.session.lot.name}\n` +
      `✍️ <b>Описание:</b> ${ctx.session.lot.link}\n` +
      `👨‍🎨 <b>Автор:</b> ${text}\n\n` +
      `Переходим к следующему этапу...`,
      [
        Markup.button.callback('❌ Отмена', 'actionStopLot')
      ],
      2
    );
    
    // Wait a moment then move to next stage
    setTimeout(() => {
      ctx.scene.enter('LOT_SCENE_PRICE_AND_TAGS_STAGE');
    }, 2000);
  }
});

lotSceneBasicInfoStage.action('skipBasicInfo', async (ctx) => {
  // Set default values for skipped fields
  if (!ctx.session.lot.name) ctx.session.lot.name = 'Без названия';
  if (!ctx.session.lot.link) ctx.session.lot.link = 'Без описания';
  if (!ctx.session.lot.author) ctx.session.lot.author = 'Неизвестный автор';
  
  await ctx.answerCbQuery('Поля заполнены значениями по умолчанию');
  ctx.scene.enter('LOT_SCENE_PRICE_AND_TAGS_STAGE');
});

lotSceneBasicInfoStage.action('actionStopLot', async (ctx) => {
  try {
    if (ctx.session.lot) {
      ctx.session.lot = null;
      ctx.scene.leave();
    } else {
      await ctx.answerCbQuery("Похоже, что ты не создаешь лот");
    }
  } catch (e) {
    console.error('Failed to handle stop lot action:', e);
  }
});

module.exports = lotSceneBasicInfoStage;
