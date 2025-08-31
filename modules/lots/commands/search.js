const { Composer, Markup } = require('telegraf');
const lotsService = require('../db/lotsService');
const lotsUtils = require('../utils');

const searchCommand = new Composer();

// Main search command
searchCommand.command('search', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  
  if (args.length === 0) {
    await showSearchMenu(ctx);
    return;
  }
  
  // Parse search query
  const searchTerm = args.join(' ');
  
  // Check if it's a hashtag search
  if (searchTerm.startsWith('#')) {
    await performHashtagSearch(ctx, searchTerm);
  } else {
    await performSearch(ctx, searchTerm);
  }
});

// Search menu
async function showSearchMenu(ctx) {
  try {
    const categories = await lotsService.getCategories();
    const categoryButtons = categories.map(cat => 
      Markup.button.callback(`${cat.icon} ${cat.name}`, `searchCategory-${cat.id}`)
    );

    const message = `🔍 <b>Поиск лотов</b>\n\n` +
      `Выберите способ поиска:\n\n` +
      `📝 <b>Поиск по тексту:</b>\n` +
      `Используйте команду /search <текст>\n\n` +
      `🏷️ <b>Поиск по хештегу:</b>\n` +
      `Используйте /search #хештег\n` +
      `Примеры: /search #warhammer40k, /search #acrylic\n\n` +
      `🏷️ <b>Поиск по категории:</b>\n` +
      `Выберите категорию ниже\n\n` +
      `💰 <b>Поиск по цене:</b>\n` +
      `Используйте /search price <максимальная_цена>`;

    const buttons = [
      categoryButtons,
      [
        Markup.button.callback('💰 По цене', 'searchByPrice'),
        Markup.button.callback('🆕 Новые лоты', 'searchNewLots')
      ],
      [
        Markup.button.callback('⭐ Популярные', 'searchPopularLots'),
        Markup.button.callback('🔍 Расширенный поиск', 'advancedSearch')
      ],
      [
        Markup.button.callback('🏷️ Популярные хештеги', 'showPopularHashtags')
      ]
    ];

    await ctx.replyWithHTML(message, Markup.inlineKeyboard(buttons));
  } catch (error) {
    console.error('Failed to show search menu:', error);
    await ctx.reply('❌ Ошибка загрузки меню поиска. Попробуйте позже.');
  }
}

// Show popular hashtags
searchCommand.action('showPopularHashtags', async (ctx) => {
  try {
    const popularHashtags = [
      { name: '#warhammer40k', count: '🔥', description: 'Warhammer 40,000' },
      { name: '#dnd', count: '⚔️', description: 'Dungeons & Dragons' },
      { name: '#acrylic', count: '🎨', description: 'Акриловые краски' },
      { name: '#fantasy', count: '🐉', description: 'Фэнтези' },
      { name: '#scifi', count: '🚀', description: 'Научная фантастика' },
      { name: '#kickstarter', count: '💡', description: 'Kickstarter проекты' },
      { name: '#limited', count: '💎', description: 'Лимитированные издания' },
      { name: '#custom', count: '✨', description: 'Кастомные товары' },
      { name: '#handmade', count: '👐', description: 'Ручная работа' },
      { name: '#vintage', count: '📜', description: 'Винтажные товары' }
    ];

    let message = `🏷️ <b>Популярные хештеги</b>\n\n` +
      `Нажмите на хештег для поиска:\n\n`;

    const buttons = [];
    
    popularHashtags.forEach((tag, index) => {
      message += `${tag.count} <b>${tag.name}</b> - ${tag.description}\n`;
      
      if (index % 2 === 0) {
        buttons.push([
          Markup.button.callback(tag.name, `searchHashtag-${tag.name}`),
          index + 1 < popularHashtags.length ? 
            Markup.button.callback(popularHashtags[index + 1].name, `searchHashtag-${popularHashtags[index + 1].name}`) :
            Markup.button.callback('', 'noop')
        ]);
      }
    });

    buttons.push([Markup.button.callback('🔙 Назад к поиску', 'backToSearch')]);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons)
    });
  } catch (error) {
    console.error('Failed to show popular hashtags:', error);
    await ctx.answerCbQuery('❌ Ошибка загрузки хештегов');
  }
});

// Handle hashtag search from buttons
searchCommand.action(/^searchHashtag-(.+)/g, async (ctx) => {
  try {
    const hashtag = ctx.callbackQuery.data.split('searchHashtag-')[1];
    await performHashtagSearch(ctx, hashtag);
  } catch (error) {
    console.error('Failed to search hashtag:', error);
    await ctx.answerCbQuery('❌ Ошибка поиска по хештегу');
  }
});

// Perform hashtag search
async function performHashtagSearch(ctx, hashtag) {
  try {
    // Clean the hashtag (remove # if present)
    const cleanHashtag = hashtag.startsWith('#') ? hashtag : `#${hashtag}`;
    
    // Search for lots with this tag
    const lots = await lotsService.searchLotsByTag(cleanHashtag, { status: 'open' });
    
    if (lots.length === 0) {
      await ctx.reply(
        `🏷️ <b>Поиск по хештегу: ${cleanHashtag}</b>\n\n` +
        `По этому хештегу пока ничего не найдено.\n\n` +
        `💡 <i>Попробуйте:</i>\n` +
        `• Проверить правильность написания\n` +
        `• Использовать похожие хештеги\n` +
        `• Поиск по категориям`,
        { parse_mode: 'HTML' }
      );
      return;
    }
    
    await showSearchResults(ctx, lots, `🏷️ <b>Результаты поиска по хештегу: ${cleanHashtag}</b>`, null, { hashtag: cleanHashtag });
  } catch (error) {
    console.error('Failed to perform hashtag search:', error);
    await ctx.reply('❌ Ошибка поиска по хештегу');
  }
}

// Search by category
searchCommand.action(/^searchCategory-(\d+)/g, async (ctx) => {
  try {
    const categoryId = parseInt(ctx.callbackQuery.data.split('searchCategory-')[1]);
    const category = await lotsService.getCategories().then(cats => cats.find(c => c.id === categoryId));
    
    const lots = await lotsService.getLots({ category: categoryId, status: 'open' });
    
    if (lots.length === 0) {
      await ctx.editMessageText(
        `🏷️ <b>Поиск по категории: ${category.icon} ${category.name}</b>\n\n` +
        `В этой категории пока нет открытых лотов.\n\n` +
        `💡 <i>Популярные хештеги в этой категории:</i>\n` +
        await getPopularHashtagsForCategory(categoryId),
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Назад к поиску', 'backToSearch')]
          ])
        }
      );
      return;
    }
    
    await showSearchResults(ctx, lots, `🏷️ <b>Результаты поиска по категории: ${category.icon} ${category.name}</b>`, categoryId);
  } catch (error) {
    console.error('Failed to search by category:', error);
    await ctx.answerCbQuery('❌ Ошибка поиска по категории');
  }
});

// Get popular hashtags for a category
async function getPopularHashtagsForCategory(categoryId) {
  try {
    const tags = await lotsService.getTagsByCategory(categoryId);
    const popularTags = tags.slice(0, 5); // Show top 5 tags
    
    return popularTags.map(tag => `• ${tag.name}`).join('\n');
  } catch (error) {
    return '• Нет доступных хештегов';
  }
}

// Search by price
searchCommand.action('searchByPrice', async (ctx) => {
  await ctx.editMessageText(
    `💰 <b>Поиск по цене</b>\n\n` +
    `Отправьте максимальную цену для поиска.\n\n` +
    `Примеры:\n` +
    `• 100 - лоты до $100\n` +
    `• 50.50 - лоты до $50.50\n` +
    `• 1000 RUB - лоты до 1000 рублей\n\n` +
    `💡 <i>Можно также добавить хештеги:</i>\n` +
    `• 100 #warhammer40k - лоты до $100 с хештегом #warhammer40k`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад к поиску', 'backToSearch')]
      ])
    }
  );
  
  // Set context for price input
  ctx.session.searchContext = { type: 'price' };
});

// Handle price input
searchCommand.on('text', async (ctx) => {
  if (!ctx.session.searchContext || ctx.session.searchContext.type !== 'price') {
    return;
  }
  
  try {
    const text = ctx.message.text.trim();
    await ctx.deleteMessage(ctx.message.message_id);
    
    // Parse price, currency, and hashtags
    const parts = text.split(' ');
    const pricePart = parts[0];
    const hashtags = parts.slice(1).filter(part => part.startsWith('#'));
    
    // Parse price and currency
    const priceMatch = pricePart.match(/^(\d+(?:\.\d+)?)\s*(USD|EUR|RUB)?$/i);
    if (!priceMatch) {
      await ctx.reply(
        `❌ <b>Неверный формат цены</b>\n\n` +
        `Используйте формат: <code>100</code> или <code>100 USD</code>\n\n` +
        `💡 <i>Можно добавить хештеги:</i>\n` +
        `<code>100 #warhammer40k #acrylic</code>`,
        { parse_mode: 'HTML' }
      );
      return;
    }
    
    const price = parseFloat(priceMatch[1]);
    const currency = (priceMatch[2] || 'USD').toUpperCase();
    
    // Build search filters
    const filters = { 
      maxPrice: price, 
      currency: currency,
      status: 'open' 
    };
    
    // Add hashtag filters if provided
    if (hashtags.length > 0) {
      filters.hashtags = hashtags;
    }
    
    // Search lots by price and hashtags
    const lots = await lotsService.getLots(filters);
    
    if (lots.length === 0) {
      let message = `💰 <b>Поиск по цене: до ${price} ${currency}</b>`;
      if (hashtags.length > 0) {
        message += `\n🏷️ <b>Хештеги:</b> ${hashtags.join(' ')}`;
      }
      message += `\n\nЛотов в этой ценовой категории не найдено.`;
      
      await ctx.reply(message, { parse_mode: 'HTML' });
      return;
    }
    
    let title = `💰 <b>Результаты поиска по цене: до ${price} ${currency}</b>`;
    if (hashtags.length > 0) {
      title += `\n🏷️ <b>Хештеги:</b> ${hashtags.join(' ')}`;
    }
    
    await showSearchResults(ctx, lots, title, null, { price, currency, hashtags });
    
    // Clear search context
    delete ctx.session.searchContext;
    
  } catch (error) {
    console.error('Failed to search by price:', error);
    await ctx.reply('❌ Ошибка поиска по цене');
  }
});

// Search new lots
searchCommand.action('searchNewLots', async (ctx) => {
  try {
    const lots = await lotsService.getLots({ 
      status: 'open',
      sortBy: 'created',
      sortOrder: 'desc'
    });
    
    const recentLots = lots.slice(0, 20); // Show last 20 lots
    
    await showSearchResults(ctx, recentLots, `🆕 <b>Новые лоты</b>`, null, { type: 'new' });
  } catch (error) {
    console.error('Failed to search new lots:', error);
    await ctx.answerCbQuery('❌ Ошибка поиска новых лотов');
  }
});

// Search popular lots
searchCommand.action('searchPopularLots', async (ctx) => {
  try {
    const lots = await lotsService.getLots({ status: 'open' });
    
    // Sort by participant count (popularity)
    const popularLots = lots
      .sort((a, b) => (b.participants?.length || 0) - (a.participants?.length || 0))
      .slice(0, 20);
    
    await showSearchResults(ctx, popularLots, `⭐ <b>Популярные лоты</b>`, null, { type: 'popular' });
  } catch (error) {
    console.error('Failed to search popular lots:', error);
    await ctx.answerCbQuery('❌ Ошибка поиска популярных лотов');
  }
});

// Advanced search
searchCommand.action('advancedSearch', async (ctx) => {
  try {
    const categories = await lotsService.getCategories();
    const categoryButtons = categories.map(cat => 
      Markup.button.callback(`${cat.icon} ${cat.name}`, `advSearchCategory-${cat.id}`)
    );

    const message = `🔍 <b>Расширенный поиск</b>\n\n` +
      `Выберите категорию для детального поиска:\n\n` +
      `💡 <i>Можно комбинировать:</i>\n` +
      `• Категории и хештеги\n` +
      `• Ценовые диапазоны\n` +
      `• Статус лотов`;

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        categoryButtons,
        [Markup.button.callback('🔙 Назад к поиску', 'backToSearch')]
      ])
    });
  } catch (error) {
    console.error('Failed to show advanced search:', error);
    await ctx.answerCbQuery('❌ Ошибка загрузки расширенного поиска');
  }
});

// Advanced search by category
searchCommand.action(/^advSearchCategory-(\d+)/g, async (ctx) => {
  try {
    const categoryId = parseInt(ctx.callbackQuery.data.split('advSearchCategory-')[1]);
    const category = await lotsService.getCategories().then(cats => cats.find(c => c.id === categoryId));
    const tags = await lotsService.getTagsByCategory(categoryId);
    
    const tagButtons = tags.map(tag => 
      Markup.button.callback(tag.name, `advSearchTag-${tag.id}`)
    );

    const message = `🔍 <b>Расширенный поиск: ${category.icon} ${category.name}</b>\n\n` +
      `Выберите хештег для поиска или используйте фильтры:`;

    const buttons = [
      tagButtons,
      [
        Markup.button.callback('💰 Фильтр по цене', `advSearchPrice-${categoryId}`),
        Markup.button.callback('📅 Фильтр по дате', `advSearchDate-${categoryId}`)
      ],
      [Markup.button.callback('🔙 Назад', 'advancedSearch')]
    ];

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons)
    });
  } catch (error) {
    console.error('Failed to show advanced search category:', error);
    await ctx.answerCbQuery('❌ Ошибка загрузки расширенного поиска');
  }
});

// Perform text search
async function performSearch(ctx, searchTerm) {
  try {
    const lots = await lotsService.searchLots(searchTerm, { status: 'open' });
    
    if (lots.length === 0) {
      await ctx.reply(
        `🔍 <b>Результаты поиска: "${searchTerm}"</b>\n\n` +
        `По вашему запросу ничего не найдено.\n\n` +
        `💡 <i>Попробуйте:</i>\n` +
        `• Изменить поисковый запрос\n` +
        `• Использовать хештеги (например: #warhammer40k)\n` +
        `• Поиск по категориям\n` +
        `• Более общие термины`,
        { parse_mode: 'HTML' }
      );
      return;
    }
    
    await showSearchResults(ctx, lots, `🔍 <b>Результаты поиска: "${searchTerm}"</b>`, null, { searchTerm });
  } catch (error) {
    console.error('Failed to perform search:', error);
    await ctx.reply('❌ Ошибка выполнения поиска');
  }
}

// Show search results
async function showSearchResults(ctx, lots, title, categoryId = null, filters = {}) {
  try {
    const maxLots = 10;
    const currentPage = 1;
    const totalPages = Math.ceil(lots.length / maxLots);
    const pageLots = lots.slice(0, maxLots);
    
    let message = `${title}\n\n`;
    
    if (filters.searchTerm) {
      message += `🔍 <b>Поисковый запрос:</b> "${filters.searchTerm}"\n`;
    }
    if (filters.hashtag) {
      message += `🏷️ <b>Хештег:</b> ${filters.hashtag}\n`;
    }
    if (filters.hashtags && filters.hashtags.length > 0) {
      message += `🏷️ <b>Хештеги:</b> ${filters.hashtags.join(' ')}\n`;
    }
    if (filters.price) {
      message += `💰 <b>Максимальная цена:</b> ${filters.price} ${filters.currency}\n`;
    }
    if (filters.type === 'new') {
      message += `📅 <b>Показаны последние ${lots.length} лотов</b>\n`;
    }
    if (filters.type === 'popular') {
      message += `⭐ <b>Сортировка по популярности</b>\n`;
    }
    
    message += `\n📊 <b>Найдено лотов:</b> ${lots.length}\n\n`;
    
    pageLots.forEach((lot, index) => {
      const participantCount = lot.participants?.length || 0;
      const tags = lot.tags?.map(t => t.name).join(' ') || '';
      
      message += `${index + 1}. <b>${lot.title}</b>\n` +
        `   💰 ${lot.price} ${lot.currency} | 👥 ${participantCount} участников\n` +
        `   👨‍🎨 ${lot.author || 'Неизвестно'}\n`;
      
      if (tags) {
        message += `   🏷️ ${tags}\n`;
      }
      
      message += `\n`;
    });
    
    if (lots.length > maxLots) {
      message += `📄 <i>Показано ${maxLots} из ${lots.length} лотов</i>\n`;
    }
    
    const buttons = [];
    
    // Pagination buttons
    if (totalPages > 1) {
      const paginationRow = [];
      if (currentPage > 1) {
        paginationRow.push(Markup.button.callback('◀️', `searchPage-${currentPage - 1}-${categoryId || 'text'}`));
      }
      paginationRow.push(Markup.button.callback(`${currentPage}/${totalPages}`, 'currentPage'));
      if (currentPage < totalPages) {
        paginationRow.push(Markup.button.callback('▶️', `searchPage-${currentPage + 1}-${categoryId || 'text'}`));
      }
      buttons.push(paginationRow);
    }
    
    // Action buttons
    buttons.push([
      Markup.button.callback('🔍 Новый поиск', 'newSearch'),
      Markup.button.callback('🔙 Назад к поиску', 'backToSearch')
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons)
    });
    
  } catch (error) {
    console.error('Failed to show search results:', error);
    await ctx.answerCbQuery('❌ Ошибка отображения результатов');
  }
}

// Navigation actions
searchCommand.action('backToSearch', async (ctx) => {
  await showSearchMenu(ctx);
});

searchCommand.action('newSearch', async (ctx) => {
  await showSearchMenu(ctx);
});

searchCommand.action('currentPage', async (ctx) => {
  // Do nothing, just show current page
  await ctx.answerCbQuery('Текущая страница');
});

searchCommand.action('noop', async (ctx) => {
  // Do nothing action for empty buttons
});

module.exports = searchCommand;
