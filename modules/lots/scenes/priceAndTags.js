const { Scenes, Markup } = require("telegraf");
const lotsUtils = require('../utils');
const lotsService = require('../db/lotsService');
const SETTINGS = require('../../../settings.json')

const lotScenePriceAndTagsStage = new Scenes.BaseScene('LOT_SCENE_PRICE_AND_TAGS_STAGE');

const currencyButtons = [
  Markup.button.callback('$ ✅', 'setCurrency-USD'),
  Markup.button.callback('€', 'setCurrency-EUR'),
  Markup.button.callback('₽', 'setCurrency-RUB'),
];

lotScenePriceAndTagsStage.enter(async (ctx) => {
  ctx.session.lot.currentStep = 3;
  ctx.session.lot.currency = 'USD';
  ctx.session.lot.tags = [];
  
  try {
    const categories = await lotsService.getCategories();
    const categoryButtons = categories.map(cat => 
      Markup.button.callback(`${cat.icon} ${cat.name}`, `selectCategory-${cat.id}`)
    );

    await lotsUtils.updateLotCreationMessage(ctx,
      `Теперь установите цену и выберите теги для лота.\n\n` +
      `💰 <b>Цена:</b> ${SETTINGS.CURRENCIES.USD.SYMBOL}0\n` +
      `🏷️ <b>Выбранные теги:</b> пока нет\n\n` +
      `Сначала введите цену лота (число), затем выберите категорию и теги.`,
      [
        currencyButtons,
        categoryButtons,
        [
          Markup.button.callback('❌ Отмена', 'actionStopLot'),
          Markup.button.callback('⏭️ Пропустить теги', 'skipTags')
        ]
      ],
      3
    );
  } catch (error) {
    console.error('Failed to load categories:', error);
    await lotsUtils.updateLotCreationMessage(ctx,
      `Ошибка загрузки категорий. Попробуйте позже.`,
      [
        Markup.button.callback('❌ Отмена', 'actionStopLot')
      ],
      3
    );
  }
});

lotScenePriceAndTagsStage.on('text', async (ctx) => {
  try {
    const price = parseFloat(ctx.message.text);
    await ctx.deleteMessage(ctx.message.message_id);
    
    if (isNaN(price) || price <= 0) {
      return await lotsUtils.updateLotCreationMessage(ctx, 
        lotsUtils.getHelpfulErrorMessage('INVALID_PRICE'),
        [
          currencyButtons,
          [
            Markup.button.callback('❌ Отмена', 'actionStopLot'),
            Markup.button.callback('⏭️ Пропустить теги', 'skipTags')
          ]
        ],
        3
      );
    }

    ctx.session.lot.price = price.toFixed(2);
    
    await lotsUtils.updateLotCreationMessage(ctx,
      `✅ Цена установлена: <b>${SETTINGS.CURRENCIES[ctx.session.lot.currency]?.SYMBOL || '$'}${price}</b>\n\n` +
      `Теперь выберите категорию и теги для лота:`,
      [
        currencyButtons,
        [
          Markup.button.callback('❌ Отмена', 'actionStopLot'),
          Markup.button.callback('⏭️ Пропустить теги', 'skipTags'),
          Markup.button.callback('✅ Завершить', 'finishPriceAndTags')
        ]
      ],
      3
    );
  } catch (e) {
    console.error('Failed to handle price input:', e);
  }
});

lotScenePriceAndTagsStage.action(/^setCurrency-(USD|EUR|RUB)/g, async ctx => {
  const currency = ctx.callbackQuery.data.split('setCurrency-')[1];
  ctx.session.lot.currency = currency;

  let menu = [];
  for (const [key, value] of Object.entries(SETTINGS.CURRENCIES)) {
    if (key == currency) {
      menu.push(Markup.button.callback(`${SETTINGS.CURRENCIES[key].SYMBOL} ✅`, `setCurrency-${key}`))
    } else {
      menu.push(Markup.button.callback(`${SETTINGS.CURRENCIES[key].SYMBOL}`, `setCurrency-${key}`))
    }
  }

  try {
    const categories = await lotsService.getCategories();
    const categoryButtons = categories.map(cat => 
      Markup.button.callback(`${cat.icon} ${cat.name}`, `selectCategory-${cat.id}`)
    );

    await lotsUtils.updateLotCreationMessage(ctx,
      `Сменил валюту на ${SETTINGS.CURRENCIES[currency].NAME}! Ожидаю стоимость лота...\n\n` +
      `💰 <b>Цена:</b> ${SETTINGS.CURRENCIES[currency].SYMBOL}${ctx.session.lot.price || '0'}\n` +
      `🏷️ <b>Выбранные теги:</b> ${ctx.session.lot.tags.length > 0 ? ctx.session.lot.tags.map(t => t.name).join(', ') : 'пока нет'}`,
      [
        menu,
        categoryButtons,
        [
          Markup.button.callback('❌ Отмена', 'actionStopLot'),
          Markup.button.callback('⏭️ Пропустить теги', 'skipTags'),
          ...(ctx.session.lot.price ? [Markup.button.callback('✅ Завершить', 'finishPriceAndTags')] : [])
        ]
      ],
      3
    )
  } catch (e) {
    console.error('Failed to change currency:', e);
  }
});

lotScenePriceAndTagsStage.action(/^selectCategory-(\d+)/g, async (ctx) => {
  try {
    const categoryId = parseInt(ctx.callbackQuery.data.split('selectCategory-')[1]);
    const tags = await lotsService.getTagsByCategory(categoryId);
    
    const tagButtons = tags.map(tag => 
      Markup.button.callback(
        ctx.session.lot.tags.some(t => t.id === tag.id) ? `✅ ${tag.name}` : tag.name,
        `toggleTag-${tag.id}`
      )
    );

    await lotsUtils.updateLotCreationMessage(ctx,
      `Выберите теги для категории. Нажмите на тег, чтобы добавить/убрать его.\n\n` +
      `💰 <b>Цена:</b> ${SETTINGS.CURRENCIES[ctx.session.lot.currency]?.SYMBOL || '$'}${ctx.session.lot.price || '0'}\n` +
      `🏷️ <b>Выбранные теги:</b> ${ctx.session.lot.tags.length > 0 ? ctx.session.lot.tags.map(t => t.name).join(', ') : 'пока нет'}`,
      [
        tagButtons,
        [
          Markup.button.callback('🔙 Назад к категориям', 'backToCategories'),
          Markup.button.callback('❌ Отмена', 'actionStopLot'),
          Markup.button.callback('⏭️ Пропустить теги', 'skipTags'),
          ...(ctx.session.lot.price ? [Markup.button.callback('✅ Завершить', 'finishPriceAndTags')] : [])
        ]
      ],
      3
    );
  } catch (error) {
    console.error('Failed to load tags:', error);
    await ctx.answerCbQuery('Ошибка загрузки тегов');
  }
});

lotScenePriceAndTagsStage.action(/^toggleTag-(\d+)/g, async (ctx) => {
  try {
    const tagId = parseInt(ctx.callbackQuery.data.split('toggleTag-')[1]);
    const tagIndex = ctx.session.lot.tags.findIndex(t => t.id === tagId);
    
    if (tagIndex === -1) {
      // Add tag
      const tags = await lotsService.getTagsByCategory(ctx.session.lot.currentCategoryId);
      const tag = tags.find(t => t.id === tagId);
      if (tag) {
        ctx.session.lot.tags.push(tag);
      }
    } else {
      // Remove tag
      ctx.session.lot.tags.splice(tagIndex, 1);
    }
    
    await ctx.answerCbQuery(`Тег ${tagIndex === -1 ? 'добавлен' : 'убран'}`);
    
    // Refresh the tag selection view
    const tags = await lotsService.getTagsByCategory(ctx.session.lot.currentCategoryId);
    const tagButtons = tags.map(tag => 
      Markup.button.callback(
        ctx.session.lot.tags.some(t => t.id === tag.id) ? `✅ ${tag.name}` : tag.name,
        `toggleTag-${tag.id}`
      )
    );

    await lotsUtils.updateLotCreationMessage(ctx,
      `Выберите теги для категории. Нажмите на тег, чтобы добавить/убрать его.\n\n` +
      `💰 <b>Цена:</b> ${SETTINGS.CURRENCIES[ctx.session.lot.currency]?.SYMBOL || '$'}${ctx.session.lot.price || '0'}\n` +
      `🏷️ <b>Выбранные теги:</b> ${ctx.session.lot.tags.length > 0 ? ctx.session.lot.tags.map(t => t.name).join(', ') : 'пока нет'}`,
      [
        tagButtons,
        [
          Markup.button.callback('🔙 Назад к категориям', 'backToCategories'),
          Markup.button.callback('❌ Отмена', 'actionStopLot'),
          Markup.button.callback('⏭️ Пропустить теги', 'skipTags'),
          ...(ctx.session.lot.price ? [Markup.button.callback('✅ Завершить', 'finishPriceAndTags')] : [])
        ]
      ],
      3
    );
  } catch (error) {
    console.error('Failed to toggle tag:', error);
    await ctx.answerCbQuery('Ошибка изменения тега');
  }
});

lotScenePriceAndTagsStage.action('backToCategories', async (ctx) => {
  try {
    const categories = await lotsService.getCategories();
    const categoryButtons = categories.map(cat => 
      Markup.button.callback(`${cat.icon} ${cat.name}`, `selectCategory-${cat.id}`)
    );

    await lotsUtils.updateLotCreationMessage(ctx,
      `Выберите категорию для лота:\n\n` +
      `💰 <b>Цена:</b> ${SETTINGS.CURRENCIES[ctx.session.lot.currency]?.SYMBOL || '$'}${ctx.session.lot.price || '0'}\n` +
      `🏷️ <b>Выбранные теги:</b> ${ctx.session.lot.tags.length > 0 ? ctx.session.lot.tags.map(t => t.name).join(', ') : 'пока нет'}`,
      [
        currencyButtons,
        categoryButtons,
        [
          Markup.button.callback('❌ Отмена', 'actionStopLot'),
          Markup.button.callback('⏭️ Пропустить теги', 'skipTags'),
          ...(ctx.session.lot.price ? [Markup.button.callback('✅ Завершить', 'finishPriceAndTags')] : [])
        ]
      ],
      3
    );
  } catch (error) {
    console.error('Failed to go back to categories:', error);
  }
});

lotScenePriceAndTagsStage.action('skipTags', async (ctx) => {
  if (!ctx.session.lot.price) {
    await ctx.answerCbQuery('Сначала установите цену!');
    return;
  }
  
  await ctx.answerCbQuery('Теги пропущены');
  ctx.scene.enter('LOT_SCENE_REVIEW_STAGE');
});

lotScenePriceAndTagsStage.action('finishPriceAndTags', async (ctx) => {
  if (!ctx.session.lot.price) {
    await ctx.answerCbQuery('Сначала установите цену!');
    return;
  }
  
  await ctx.answerCbQuery('Переходим к предварительному просмотру');
  ctx.scene.enter('LOT_SCENE_REVIEW_STAGE');
});

lotScenePriceAndTagsStage.action('actionStopLot', async (ctx) => {
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

module.exports = lotScenePriceAndTagsStage;
