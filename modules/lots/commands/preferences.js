const { Composer, Markup } = require('telegraf');
const lotsService = require('../db/lotsService');
const lotsUtils = require('../utils');

const preferencesCommand = new Composer();

// Main preferences command
preferencesCommand.command('preferences', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const prefs = await lotsService.getUserPreferences(userId);
    
    const message = `⚙️ <b>Ваши настройки</b>\n\n` +
      `💰 <b>Предпочитаемая валюта:</b> ${prefs.preferred_currency}\n` +
      `🔔 <b>Уведомления:</b>\n` +
      `  • Новые лоты: ${prefs.notification_settings.new_lots ? '✅' : '❌'}\n` +
      `  • Ценовые уведомления: ${prefs.notification_settings.price_alerts ? '✅' : '❌'}\n` +
      `  • Обновления категорий: ${prefs.notification_settings.category_updates ? '✅' : '❌'}\n\n` +
      `🏷️ <b>Любимые категории:</b> ${prefs.favorite_categories.length > 0 ? prefs.favorite_categories.join(', ') : 'не выбраны'}\n` +
      `⭐ <b>Любимые теги:</b> ${prefs.favorite_tags.length > 0 ? prefs.favorite_tags.join(', ') : 'не выбраны'}`;

    const buttons = [
      [
        Markup.button.callback('💰 Изменить валюту', 'changeCurrency'),
        Markup.button.callback('🔔 Настройки уведомлений', 'changeNotifications')
      ],
      [
        Markup.button.callback('🏷️ Любимые категории', 'manageCategories'),
        Markup.button.callback('⭐ Любимые теги', 'manageTags')
      ],
      [
        Markup.button.callback('🔍 Мои избранные лоты', 'showFavorites'),
        Markup.button.callback('📊 Статистика', 'showStats')
      ]
    ];

    await ctx.replyWithHTML(message, Markup.inlineKeyboard(buttons));
  } catch (error) {
    console.error('Failed to show preferences:', error);
    await ctx.reply('❌ Ошибка загрузки настроек. Попробуйте позже.');
  }
});

// Change currency
preferencesCommand.action('changeCurrency', async (ctx) => {
  const currencies = [
    { code: 'USD', symbol: '$', name: 'Доллары' },
    { code: 'EUR', symbol: '€', name: 'Евро' },
    { code: 'RUB', symbol: '₽', name: 'Рубли' }
  ];

  const buttons = currencies.map(curr => 
    Markup.button.callback(`${curr.symbol} ${curr.name}`, `setPrefCurrency-${curr.code}`)
  );

  await ctx.editMessageText(
    `💰 <b>Выберите предпочитаемую валюту:</b>\n\n` +
    `Это повлияет на отображение цен в лотах.`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        buttons,
        [Markup.button.callback('🔙 Назад', 'backToPreferences')]
      ])
    }
  );
});

preferencesCommand.action(/^setPrefCurrency-(USD|EUR|RUB)/g, async (ctx) => {
  try {
    const currency = ctx.callbackQuery.data.split('setPrefCurrency-')[1];
    const userId = ctx.from.id;
    
    await lotsService.updateUserPreferences(userId, { preferred_currency: currency });
    
    await ctx.answerCbQuery(`✅ Валюта изменена на ${currency}`);
    ctx.scene.enter('PREFERENCES_SCENE');
  } catch (error) {
    console.error('Failed to update currency:', error);
    await ctx.answerCbQuery('❌ Ошибка изменения валюты');
  }
});

// Manage favorite categories
preferencesCommand.action('manageCategories', async (ctx) => {
  try {
    const categories = await lotsService.getCategories();
    const userId = ctx.from.id;
    const prefs = await lotsService.getUserPreferences(userId);
    
    const buttons = categories.map(cat => {
      const isFavorite = prefs.favorite_categories.includes(cat.id);
      return Markup.button.callback(
        `${isFavorite ? '✅' : '❌'} ${cat.icon} ${cat.name}`,
        `toggleCategory-${cat.id}`
      );
    });

    await ctx.editMessageText(
      `🏷️ <b>Управление любимыми категориями</b>\n\n` +
      `Выберите категории, которые вас интересуют. ` +
      `Вы будете получать уведомления о новых лотах в этих категориях.`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          buttons,
          [Markup.button.callback('🔙 Назад', 'backToPreferences')]
        ])
      }
    );
  } catch (error) {
    console.error('Failed to show categories:', error);
    await ctx.answerCbQuery('❌ Ошибка загрузки категорий');
  }
});

preferencesCommand.action(/^toggleCategory-(\d+)/g, async (ctx) => {
  try {
    const categoryId = parseInt(ctx.callbackQuery.data.split('toggleCategory-')[1]);
    const userId = ctx.from.id;
    const prefs = await lotsService.getUserPreferences(userId);
    
    const categoryIndex = prefs.favorite_categories.indexOf(categoryId);
    if (categoryIndex === -1) {
      prefs.favorite_categories.push(categoryId);
    } else {
      prefs.favorite_categories.splice(categoryIndex, 1);
    }
    
    await lotsService.updateUserPreferences(userId, { favorite_categories: prefs.favorite_categories });
    
    await ctx.answerCbQuery(`Категория ${categoryIndex === -1 ? 'добавлена' : 'убрана'} из избранного`);
    
    // Refresh the view
    ctx.action('manageCategories');
  } catch (error) {
    console.error('Failed to toggle category:', error);
    await ctx.answerCbQuery('❌ Ошибка изменения категории');
  }
});

// Manage favorite tags
preferencesCommand.action('manageTags', async (ctx) => {
  try {
    const tags = await lotsService.getAllTags();
    const userId = ctx.from.id;
    const prefs = await lotsService.getUserPreferences(userId);
    
    // Group tags by category
    const tagsByCategory = {};
    tags.forEach(tag => {
      if (!tagsByCategory[tag.category_name]) {
        tagsByCategory[tag.category_name] = [];
      }
      tagsByCategory[tag.category_name].push(tag);
    });
    
    let message = `⭐ <b>Управление любимыми тегами</b>\n\n`;
    const buttons = [];
    
    Object.entries(tagsByCategory).forEach(([categoryName, categoryTags]) => {
      message += `\n<b>${categoryName}:</b>\n`;
      const categoryButtons = categoryTags.map(tag => {
        const isFavorite = prefs.favorite_tags.includes(tag.id);
        return Markup.button.callback(
          `${isFavorite ? '✅' : '❌'} ${tag.name}`,
          `toggleTag-${tag.id}`
        );
      });
      
      // Split buttons into rows of 2
      for (let i = 0; i < categoryButtons.length; i += 2) {
        buttons.push(categoryButtons.slice(i, i + 2));
      }
    });

    buttons.push([Markup.button.callback('🔙 Назад', 'backToPreferences')]);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons)
    });
  } catch (error) {
    console.error('Failed to show tags:', error);
    await ctx.answerCbQuery('❌ Ошибка загрузки тегов');
  }
});

preferencesCommand.action(/^toggleTag-(\d+)/g, async (ctx) => {
  try {
    const tagId = parseInt(ctx.callbackQuery.data.split('toggleTag-')[1]);
    const userId = ctx.from.id;
    const prefs = await lotsService.getUserPreferences(userId);
    
    const tagIndex = prefs.favorite_tags.indexOf(tagId);
    if (tagIndex === -1) {
      prefs.favorite_tags.push(tagId);
    } else {
      prefs.favorite_tags.splice(tagIndex, 1);
    }
    
    await lotsService.updateUserPreferences(userId, { favorite_tags: prefs.favorite_tags });
    
    await ctx.answerCbQuery(`Тег ${tagIndex === -1 ? 'добавлен' : 'убран'} из избранного`);
    
    // Refresh the view
    ctx.action('manageTags');
  } catch (error) {
    console.error('Failed to toggle tag:', error);
    await ctx.answerCbQuery('❌ Ошибка изменения тега');
  }
});

// Show favorites
preferencesCommand.action('showFavorites', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const favorites = await lotsService.getUserFavorites(userId);
    
    if (favorites.length === 0) {
      await ctx.editMessageText(
        `⭐ <b>Ваши избранные лоты</b>\n\n` +
        `У вас пока нет избранных лотов. ` +
        `Нажимайте кнопку "⭐ В избранное" на интересных лотах!`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Назад', 'backToPreferences')]
          ])
        }
      );
      return;
    }
    
    let message = `⭐ <b>Ваши избранные лоты</b>\n\n`;
    favorites.slice(0, 10).forEach((lot, index) => {
      message += `${index + 1}. <b>${lot.title}</b> - ${lot.price} ${lot.currency}\n`;
    });
    
    if (favorites.length > 10) {
      message += `\n... и еще ${favorites.length - 10} лотов`;
    }
    
    const buttons = [
      [Markup.button.callback('🔙 Назад', 'backToPreferences')]
    ];
    
    if (favorites.length > 10) {
      buttons.unshift([Markup.button.callback('📄 Показать все', 'showAllFavorites')]);
    }

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons)
    });
  } catch (error) {
    console.error('Failed to show favorites:', error);
    await ctx.answerCbQuery('❌ Ошибка загрузки избранного');
  }
});

// Show stats
preferencesCommand.action('showStats', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const prefs = await lotsService.getUserPreferences(userId);
    const favorites = await lotsService.getUserFavorites(userId);
    
    // Get user's created lots
    const createdLots = await lotsService.getLots({ createdBy: userId });
    const participatingLots = await lotsService.getLots({ participant: userId });
    
    const message = `📊 <b>Ваша статистика</b>\n\n` +
      `🎯 <b>Созданные лоты:</b> ${createdLots.length}\n` +
      `👥 <b>Участвуете в лотах:</b> ${participatingLots.length}\n` +
      `⭐ <b>Избранных лотов:</b> ${favorites.length}\n` +
      `🏷️ <b>Любимых категорий:</b> ${prefs.favorite_categories.length}\n` +
      `🔖 <b>Любимых тегов:</b> ${prefs.favorite_tags.length}\n\n` +
      `💰 <b>Предпочитаемая валюта:</b> ${prefs.preferred_currency}`;

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'backToPreferences')]
      ])
    });
  } catch (error) {
    console.error('Failed to show stats:', error);
    await ctx.answerCbQuery('❌ Ошибка загрузки статистики');
  }
});

// Back to preferences
preferencesCommand.action('backToPreferences', async (ctx) => {
  ctx.action('preferences');
});

module.exports = preferencesCommand;
