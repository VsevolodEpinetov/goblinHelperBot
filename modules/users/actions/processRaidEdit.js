const { Composer, Markup } = require("telegraf");
const raidsService = require('../../raids/db/raidsService');

module.exports = Composer.hears(/^.+$/, async (ctx, next) => {
  // Only process if user is editing a raid
  if (!ctx.session.editingRaid) {
    return next();
  }
  
  try {
    const { id: raidId, field } = ctx.session.editingRaid;
    const newValue = ctx.message.text.trim();
    
    // Validate the input
    if (!newValue || newValue.length === 0) {
      await ctx.reply('❌ Значение не может быть пустым. Попробуйте еще раз:');
      return;
    }
    
    // Update the raid based on the field being edited
    let updateData = {};
    let successMessage = '';
    
    switch (field) {
      case 'title':
        updateData = { title: newValue };
        successMessage = `✅ Название рейда обновлено на: <b>${newValue}</b>`;
        break;
      case 'description':
        updateData = { description: newValue };
        successMessage = `✅ Описание рейда обновлено`;
        break;
      case 'link':
        updateData = { link: newValue };
        successMessage = `✅ Ссылка рейда обновлена на: <b>${newValue}</b>`;
        break;
      case 'price':
        const price = parseFloat(newValue);
        if (isNaN(price) || price <= 0) {
          await ctx.reply('❌ Цена должна быть положительным числом. Попробуйте еще раз:');
          return;
        }
        updateData = { price: price };
        successMessage = `✅ Цена рейда обновлена на: <b>${price}</b>`;
        break;
      case 'date':
        // For now, just store as text. Could add date validation later
        updateData = { end_date: newValue };
        successMessage = `✅ Дата окончания обновлена на: <b>${newValue}</b>`;
        break;
      default:
        await ctx.reply('❌ Неизвестное поле для редактирования');
        return;
    }
    
    // Update the raid in database
    const result = await raidsService.updateRaid(raidId, updateData);
    
    if (result.success) {
      // Clear the editing session
      delete ctx.session.editingRaid;
      
      // Show success message and return to raid management
      const message = successMessage + `\n\nВозвращаемся к управлению рейдом...`;
      
      await ctx.reply(message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('⚔️ Управление рейдом', `manageRaid_${raidId}`)]
        ])
      });
    } else {
      await ctx.reply('❌ Ошибка при обновлении рейда. Попробуйте еще раз:');
    }
    
  } catch (error) {
    console.error('Error in processRaidEdit:', error);
    await ctx.reply(require('../../../modules/i18n').t('raids.common.loadError'));
    
    // Clear the editing session on error
    delete ctx.session.editingRaid;
  }
});
