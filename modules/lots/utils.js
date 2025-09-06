const { Markup } = require("telegraf");
const SETTINGS = require('../../settings.json');
const { getSetting } = require('../db/helpers');

// Progress tracking for lot creation
const LOT_CREATION_STEPS = {
  PHOTOS: { step: 1, name: '🖼 Фото', description: 'Загрузка изображений' },
  BASIC_INFO: { step: 2, name: '📝 Основная информация', description: 'Название, описание, автор' },
  PRICE_AND_TAGS: { step: 3, name: '💰 Цена и теги', description: 'Стоимость, валюта, категории' },
  REVIEW: { step: 4, name: '👀 Предварительный просмотр', description: 'Проверка и подтверждение' }
};

// Generate progress bar for lot creation
function generateProgressBar(currentStep, totalSteps = 4) {
  const progress = Math.round((currentStep / totalSteps) * 100);
  const filledBlocks = Math.round(progress / 10);
  const emptyBlocks = 10 - filledBlocks;
  
  const filled = '█'.repeat(filledBlocks);
  const empty = '░'.repeat(emptyBlocks);
  
  return `${filled}${empty} ${progress}%`;
}

// Enhanced lot caption with better formatting and hashtag-style tags
async function getLotCaption(ctx, { author, name, link, price, currency, organizator, status, participants, tags = [], lotId = null }) {
  const statusLabel = status ? '✅ ОТКРЫТ НАБОР' : '❌ ЛОТ ЗАКРЫТ';
  const participantsList = participants.map((p, index) => `${index + 1}. @${p.username || p.first_name}`).join('\n') || 'Нет участников';
  const exchangeRate = await getSetting(currency) || SETTINGS.CURRENCIES[currency]?.EXCHANGE_RATE || 1;

  // Format hashtag-style tags display
  const tagsDisplay = tags.length > 0 
    ? `\n🏷️ <b>Хештеги:</b>\n${tags.map(tag => `  ${tag.name}`).join(' ')}\n`
    : '';

  let message = `<b>${author || 'без автора'}</b>\n` +
    `<i>${name || 'без названия'}</i>\n\n` +
    `✍️ <b>Описание:</b> ${link || 'без описания'}\n` +
    `💰 <b>Цена:</b> ${SETTINGS.CURRENCIES[currency]?.SYMBOL || '$'}${price}${(currency && currency !== 'RUB') ? ` (${Math.ceil(price * exchangeRate)}₽)` : ''}\n\n` +
    `<b>Организатор:</b> ${organizator}\n` +
    `<b>Статус:</b> ${statusLabel}\n\n` +
    `<b>Участники:</b>\n${participantsList}\n\n` +
    `${participants.length > 0 ? `💶 <b>Каждый платит по:</b> ${formatCurrency(exchangeRate, currency, price, participants.length)}\n\n` : ''}` +
    `${tagsDisplay}` +
    (status ? `<i>Если ты присоединишься, то цена участия будет ${formatCurrency(exchangeRate, currency, price, participants.length + 1)}</i>\n\n#opened_lot` : '#closed_lot');

  // Add lot ID for reference if available
  if (lotId !== null) {
    message += `\n\n🆔 <b>ID лота:</b> #${lotId}`;
  }

  // Handle long messages gracefully
  if (message.length > 1023) {
    return getShortLotCaption({ author, name, price, currency, organizator, status, participants, tags, lotId });
  }

  return message;
}

// Short version for long captions
function getShortLotCaption({ author, name, price, currency, organizator, status, participants, tags, lotId }) {
  const statusLabel = status ? '✅ ОТКРЫТ' : '❌ ЗАКРЫТ';
  const tagsDisplay = tags.length > 0 
    ? `\n🏷️ ${tags.slice(0, 3).map(tag => tag.name).join(' ')}${tags.length > 3 ? '...' : ''}`
    : '';

  let message = `<b>${author || 'без автора'}</b>\n` +
    `<i>${name || 'без названия'}</i>\n\n` +
    `💰 <b>Цена:</b> ${SETTINGS.CURRENCIES[currency]?.SYMBOL || '$'}${price}\n` +
    `<b>Организатор:</b> ${organizator}\n` +
    `<b>Статус:</b> ${statusLabel}\n` +
    `<b>Участников:</b> ${participants.length}` +
    `${tagsDisplay}\n\n` +
    (status ? '#opened_lot' : '#closed_lot');

  if (lotId !== null) {
    message += `\n🆔 #${lotId}`;
  }

  return message;
}

function formatCurrency(exchangeRate, currency, totalPrice, amountOfParticipants) {
  if (amountOfParticipants === 0) return '0';
  
  const pricePerMember = totalPrice / amountOfParticipants;
  return `${SETTINGS.CURRENCIES[currency]?.SYMBOL || '$'}${currency == 'RUB' ? parseInt(pricePerMember) : parseFloat(pricePerMember).toFixed(2)}${(currency && currency != "RUB") ? ` (${Math.ceil(pricePerMember * exchangeRate)}₽)` : ''}`;
}

// Enhanced message caption update with better error handling
async function updateLotMessageCaption(ctx, lotID, lotData, isClosed = false) {
  try {
    const organizator = `${lotData.whoCreated?.first_name || ''} ${lotData.whoCreated?.last_name || ''}${lotData.whoCreated?.username ? ` (@${lotData.whoCreated.username})` : ''}`.trim();

    const updatedCaption = await getLotCaption(ctx, {
      author: lotData.author,
      name: lotData.name,
      link: lotData.link,
      price: lotData.price,
      currency: lotData.currency,
      organizator,
      status: !isClosed,
      participants: lotData.participants || [],
      tags: lotData.tags || [],
      lotId: lotID
    });

    const buttons = isClosed
      ? []
      : [
        [
          Markup.button.callback('✅ Присоединиться', `action-join-lot-${lotID}`),
          Markup.button.callback('🏃 Выйти', `action-leave-lot-${lotID}`)
        ],
        [
          Markup.button.callback('❌ Закрыть', `action-close-lot-${lotID}`),
          Markup.button.callback('🗑 Удалить', `action-delete-lot-${lotID}`),
          Markup.button.callback('✍️ Редактировать', `action-edit-lot-${lotID}`)
        ],
        [
          Markup.button.callback('⭐ В избранное', `action-favorite-lot-${lotID}`),
          Markup.button.callback('🔍 Подробнее', `action-details-lot-${lotID}`)
        ]
      ];

    // Edit the message with the new caption and buttons
    await ctx.telegram.editMessageCaption(
      lotData.chatID,
      lotData.messageID,
      null,
      updatedCaption,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons),
      }
    );
  } catch (error) {
    console.error('Failed to update lot message caption:', error);
    // Fallback to simple text update if caption update fails
    try {
      await ctx.telegram.editMessageText(
        lotData.chatID,
        lotData.messageID,
        null,
        `Ошибка обновления лота. Попробуйте позже.`,
        { parse_mode: 'HTML' }
      );
    } catch (fallbackError) {
      console.error('Fallback update also failed:', fallbackError);
    }
  }
}

// Enhanced lot creation message with progress bar
async function updateLotCreationMessage(ctx, message, buttons = [Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')], currentStep = 1) {
  const progressBar = generateProgressBar(currentStep);
  const stepInfo = LOT_CREATION_STEPS[currentStep] || LOT_CREATION_STEPS.PHOTOS;
  
  const enhancedMessage = `${message}\n\n${progressBar}\n<b>Этап ${currentStep}/4:</b> ${stepInfo.name}\n${stepInfo.description}`;

  try {
    await ctx.telegram.editMessageText(
      ctx.session.lot.chatID,
      ctx.session.lot.messageID,
      null,
      enhancedMessage,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
      }
    );
  } catch (error) {
    console.error('Failed to update lot creation message:', error);
    throw error;
  }
}

// Generate lot preview for review stage
function generateLotPreview(lotData) {
  const organizator = `${lotData.whoCreated?.first_name || ''} ${lotData.whoCreated?.last_name || ''}${lotData.whoCreated?.username ? ` (@${lotData.whoCreated.username})` : ''}`.trim();
  
  const tagsDisplay = lotData.tags && lotData.tags.length > 0 
    ? `\n🏷️ <b>Хештеги:</b>\n${lotData.tags.map(t => `  ${t.name}`).join(' ')}`
    : '\n🏷️ <b>Хештеги:</b> не выбраны';
  
  return `🎯 <b>ПРЕДВАРИТЕЛЬНЫЙ ПРОСМОТР ЛОТА</b>\n\n` +
    `📝 <b>Название:</b> ${lotData.name || 'не указано'}\n` +
    `✍️ <b>Описание:</b> ${lotData.link || 'не указано'}\n` +
    `👨‍🎨 <b>Автор:</b> ${lotData.author || 'не указан'}\n` +
    `💰 <b>Цена:</b> ${SETTINGS.CURRENCIES[lotData.currency]?.SYMBOL || '$'}${lotData.price || 'не указана'}\n` +
    `🖼 <b>Фотографий:</b> ${lotData.photos?.length || 0}` +
    `${tagsDisplay}\n\n` +
    `👤 <b>Организатор:</b> ${organizator}\n\n` +
    `⚠️ <i>Проверьте все данные перед публикацией!</i>`;
}

// Enhanced error messages with helpful hints
function getHelpfulErrorMessage(errorType, context = {}) {
  const errorMessages = {
    'INVALID_PRICE': {
      title: '❌ Неверная цена',
      message: 'Пожалуйста, введите корректное число (например: 25 или 25.50)',
      hint: '💡 Совет: Используйте точку для дробных чисел, запятая не поддерживается'
    },
    'INVALID_PHOTO': {
      title: '❌ Неверный формат',
      message: 'Пожалуйста, отправьте изображение, а не документ',
      hint: '💡 Совет: При отправке выберите "Сжать изображение" в Telegram'
    },
    'TOO_MANY_PHOTOS': {
      title: '❌ Слишком много фото',
      message: `Максимальное количество фотографий: ${context.maxPhotos || 10}`,
      hint: '💡 Совет: Выберите самые качественные и информативные изображения'
    },
    'EMPTY_FIELD': {
      title: '❌ Пустое поле',
      message: `Поле "${context.fieldName || 'неизвестно'}" не может быть пустым`,
      hint: '💡 Совет: Заполните все обязательные поля для создания лота'
    },
    'LOT_NOT_FOUND': {
      title: '❌ Лот не найден',
      message: 'Запрашиваемый лот не существует или был удален',
      hint: '💡 Совет: Попробуйте обновить список лотов или создать новый'
    },
    'ALREADY_PARTICIPATING': {
      title: '❌ Уже участвуете',
      message: 'Вы уже являетесь участником этого лота',
      hint: '💡 Совет: Используйте кнопку "Выйти" если хотите покинуть лот'
    },
    'INVALID_HASHTAG': {
      title: '❌ Неверный хештег',
      message: 'Хештег должен начинаться с # и содержать только буквы, цифры и подчеркивания',
      hint: '💡 Примеры: #warhammer40k, #acrylic, #fantasy'
    }
  };

  const error = errorMessages[errorType] || {
    title: '❌ Ошибка',
    message: 'Произошла неизвестная ошибка',
    hint: '💡 Совет: Попробуйте повторить действие позже'
  };

  return `${error.title}\n\n${error.message}\n\n${error.hint}`;
}

// Checks if a user is the creator or an admin
function isUserAuthorizedToClose(ctx, lotData) {
  const userID = ctx.callbackQuery.from.id;
  return userID === lotData.whoCreated?.id || userID === SETTINGS.CHATS.EPINETOV;
}

// Initialize lot session with enhanced structure
function initializeLotSession(ctx) {
  if (!ctx.session.lot) {
    ctx.session.lot = {
      photos: [],
      tags: [],
      whoCreated: ctx.from,
      participants: [],
      opened: true,
      currentStep: 1,
      errors: [],
      metadata: {}
    };
  }
}

// Validate lot data before creation
function validateLotData(lotData) {
  const errors = [];
  
  if (!lotData.name || lotData.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Название лота обязательно' });
  }
  
  if (!lotData.price || isNaN(lotData.price) || lotData.price <= 0) {
    errors.push({ field: 'price', message: 'Цена должна быть положительным числом' });
  }
  
  if (!lotData.photos || lotData.photos.length === 0) {
    errors.push({ field: 'photos', message: 'Добавьте хотя бы одно фото' });
  }
  
  if (lotData.photos && lotData.photos.length > 10) {
    errors.push({ field: 'photos', message: 'Максимум 10 фотографий' });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Validate hashtag format
function validateHashtag(hashtag) {
  if (!hashtag.startsWith('#')) {
    return { isValid: false, error: 'Хештег должен начинаться с #' };
  }
  
  const hashtagPattern = /^#[a-zA-Z0-9_]+$/;
  if (!hashtagPattern.test(hashtag)) {
    return { isValid: false, error: 'Хештег может содержать только буквы, цифры и подчеркивания' };
  }
  
  return { isValid: true };
}

// Format hashtags for display
function formatHashtags(tags) {
  if (!tags || tags.length === 0) return '';
  
  return tags.map(tag => {
    // If tag already has #, return as is, otherwise add #
    return tag.name.startsWith('#') ? tag.name : `#${tag.name}`;
  }).join(' ');
}

module.exports = {
  getLotCaption,
  getShortLotCaption,
  updateLotMessageCaption,
  updateLotCreationMessage,
  generateLotPreview,
  getHelpfulErrorMessage,
  isUserAuthorizedToClose,
  initializeLotSession,
  validateLotData,
  validateHashtag,
  formatHashtags,
  generateProgressBar,
  LOT_CREATION_STEPS
};
