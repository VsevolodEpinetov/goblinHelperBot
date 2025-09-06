const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const { getUser } = require('../../db/helpers');

module.exports = Composer.command('paymentadminhelp', async (ctx) => {
  // Check if user is admin
  const adminUser = await getUser(ctx.message.from.id);
  if (!adminUser || !adminUser.roles || !adminUser.roles.includes('admin')) {
    return;
  }

  const message = `🔧 <b>Администрирование платежей</b>\\n\\n`;
  
  message += `🔑 <b>Создание кодов:</b>\\n`;
  message += `• <code>/generatecode @username amount type [description]</code>\\n`;
  message += `• Создает код для конкретного пользователя\\n`;
  message += `• Пример: <code>/generatecode @john_doe 1000 balance</code>\\n\\n`;
  
  message += `📊 <b>Просмотр кодов:</b>\\n`;
  message += `• <code>/checkcodes</code> - общая статистика\\n`;
  message += `• <code>/checkcodes pending</code> - ожидающие платежи\\n`;
  message += `• <code>/checkcodes processed</code> - обработанные платежи\\n`;
  message += `• <code>/checkcodes CODE</code> - детали по коду\\n\\n`;
  
  message += `✅ <b>Обработка платежей:</b>\\n`;
  message += `• <code>/processnote CODE "note text"</code>\\n`;
  message += `• Обрабатывает платеж по коду\\n`;
  message += `• Пример: <code>/processnote ABC123 "Payment received"</code>\\n\\n`;
  
  message += `💰 <b>Типы платежей:</b>\\n`;
  message += `• <code>balance</code> - пополнение баланса пользователя\\n`;
  message += `• <code>premium</code> - активация премиум подписки\\n\\n`;
  
  message += `📋 <b>Процесс обработки:</b>\\n`;
  message += `1. Пользователь запрашивает код (<code>/requestcode</code>)\\n`;
  message += `2. Бот уведомляет всех админов\\n`;
  message += `3. Пользователь оплачивает через PayPal с кодом в заметке\\n`;
  message += `4. Админ обрабатывает платеж (<code>/processnote</code>)\\n`;
  message += `5. Система автоматически применяет бонусы\\n\\n`;
  
  message += `⚠️ <b>Важные моменты:</b>\\n`;
  message += `• Коды генерируются автоматически при запросе\\n`;
  message += `• Максимум 3 ожидающих кода на пользователя\\n`;
  message += `• При обработке premium: 100 = 1 день подписки\\n`;
  message += `• Все операции логируются в консоль\\n`;
  message += `• Коды хранятся в памяти (перезапуск бота очищает их)`;

  await ctx.replyWithHTML(message);
});
