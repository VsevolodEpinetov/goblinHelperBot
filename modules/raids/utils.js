const { Markup } = require("telegraf");
const SETTINGS = require('../../settings.json');
const { getSetting } = require('../db/helpers');

// Progress tracking for raid creation
const RAID_CREATION_STEPS = {
  PHOTOS: { step: 1, name: '🖼 Фото', description: 'Загрузка изображений' },
  LINK: { step: 2, name: '🔗 Ссылка', description: 'Ссылка на товар' },
  PRICE: { step: 3, name: '💰 Цена', description: 'Стоимость товара' },
  DESCRIPTION: { step: 4, name: '📝 Описание', description: 'Описание рейда' },
  DATE: { step: 5, name: '📅 Дата', description: 'Дата окончания' },
  REVIEW: { step: 6, name: '👀 Просмотр', description: 'Проверка и создание' }
};

// Generate progress bar for raid creation
function generateProgressBar(currentStep, totalSteps = 6) {
  const progress = Math.round((currentStep / totalSteps) * 100);
  const filledBlocks = Math.round(progress / 10);
  const emptyBlocks = 10 - filledBlocks;
  
  const filled = '█'.repeat(filledBlocks);
  const empty = '░'.repeat(emptyBlocks);
  
  return `${filled}${empty} ${progress}%`;
}

// Initialize raid session with enhanced structure
function initializeRaidSession(ctx) {
  if (!ctx.session.raid) {
    ctx.session.raid = {
      photos: [],
      link: '',
      price: null,
      currency: '',
      description: '',
      endDate: null,
      whoCreated: ctx.from,
      participants: [],
      opened: true,
      currentStep: 1,
      errors: [],
      metadata: {},
      lastBotMessageId: null
    };
  }
}

// Helper function to send message with cleanup
async function sendMessageWithCleanup(ctx, message, keyboard) {
  // Delete previous bot message to avoid clutter
  if (ctx.session.raid && ctx.session.raid.lastBotMessageId) {
    try {
      await ctx.deleteMessage(ctx.session.raid.lastBotMessageId);
    } catch (error) {
      console.log('Could not delete previous message:', error.message);
    }
  }
  
  const sentMessage = await ctx.reply(message, {
    parse_mode: 'HTML',
    ...keyboard
  });
  
  // Store message ID for cleanup
  if (ctx.session.raid) {
    ctx.session.raid.lastBotMessageId = sentMessage.message_id;
  }
  
  return sentMessage;
}

// Format raid data for display
function formatRaidData(raidData) {
  const endDateText = raidData.endDate ? 
    new Date(raidData.endDate).toLocaleDateString('ru-RU') : 'Не указана';
  
  const priceText = raidData.price && raidData.currency ? 
    `${raidData.price} ${raidData.currency}` : 'Не указана';
  
  return {
    photos: raidData.photos?.length || 0,
    link: raidData.link || 'Не указана',
    price: priceText,
    description: raidData.description || 'Не указано',
    endDate: endDateText
  };
}

// Check if user is authorized to manage raid
function isUserAuthorizedToManage(ctx, raidData) {
  const userID = ctx.from.id;
  return userID === raidData.whoCreated?.id || userID === SETTINGS.CHATS.EPINETOV;
}

// Generate raid display message
function generateRaidMessage(raidData, isPreview = false) {
  const formatted = formatRaidData(raidData);
  const status = isPreview ? '👀 Предварительный просмотр' : '⚔️ Рейд активен';
  
  let message = `${status}\n\n`;
  
  if (formatted.photos > 0) {
    message += `🖼 <b>Фотографии:</b> ${formatted.photos} шт.\n`;
  }
  
  if (formatted.link !== 'Не указана') {
    message += `🔗 <b>Ссылка:</b> ${formatted.link}\n`;
  }
  
  message += `💰 <b>Цена:</b> ${formatted.price}\n`;
  message += `📄 <b>Описание:</b> ${formatted.description}\n`;
  message += `📅 <b>Дата окончания:</b> ${formatted.endDate}\n`;
  
  if (!isPreview) {
    message += `\n👥 <b>Участники:</b> ${raidData.participants?.length || 0} чел.\n`;
    message += `💵 <b>Цена с человека:</b> ${raidData.price && raidData.participants?.length > 0 ? 
      (raidData.price / raidData.participants.length).toFixed(2) : 'Не рассчитано'} ${raidData.currency || ''}`;
  }
  
  return message;
}

module.exports = {
  RAID_CREATION_STEPS,
  generateProgressBar,
  initializeRaidSession,
  sendMessageWithCleanup,
  formatRaidData,
  isUserAuthorizedToManage,
  generateRaidMessage
};
