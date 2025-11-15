const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { t } = require('../../../modules/i18n');
const scrollsConfig = require('../../../configs/scrolls');

module.exports = Composer.action('userScrolls', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  const userId = ctx.from.id;
  
  try {
    const userData = await getUser(userId);
    
    if (!userData) {
      await ctx.editMessageText(t('messages.user_not_found'), { 
        parse_mode: 'HTML', 
        ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.back'), 'refreshUserStatus')]]) 
      });
      return;
    }
    
    // Get scrolls from new system
    const { getUserScrolls } = require('../../util/scrolls');
    const userScrolls = await getUserScrolls(userId);
    const totalScrolls = userScrolls.reduce((total, scroll) => total + scroll.amount, 0);
    
    let message = `📜 <b>СВИТКИ КРУГОВ</b>\n\n`;
    
    if (totalScrolls === 0) {
      message += `В твоём гримуаре пока нет ни одного свитка Круга.\n\n`;
      message += `💡 <b>Как появляются свитки:</b>\n`;
      message += `Совет логова выдают свитки за заслуги, участие в орде и особую активность.\n\n`;
      message += `📜 <b>Свитки Кругов:</b>\n`;
      scrollsConfig.scrolls.forEach(scroll => {
        message += `• <b>${scroll.name}</b> — для сделок до ${scroll.priceThreshold}⭐\n`;
      });
    } else {
      message += `📊 <b>Всего свитков Кругов:</b> ${totalScrolls}\n\n`;
      message += `📜 <b>Твои свитки:</b>\n`;
      
      userScrolls.forEach(scroll => {
        const scrollDef = scroll.scrollDef;
        if (scrollDef) {
          let scrollLine = `• <b>${scrollDef.name}</b>: ${scroll.amount} шт.`;
          if (scroll.lifetime) {
            const lifetimeDate = new Date(scroll.lifetime);
            const now = new Date();
            if (lifetimeDate > now) {
              scrollLine += ` (до ${lifetimeDate.toLocaleDateString('ru-RU')})`;
            } else {
              scrollLine += ` ⚠️ <i>истёк</i>`;
            }
          }
          scrollLine += ` — для сделок до ${scrollDef.priceThreshold}⭐\n`;
          message += scrollLine;
        }
      });
      
      message += `\n💡 <b>Для чего нужны свитки:</b>\n`;
      message += `• <b>Сделки с демонами</b> — выкуп кикстартер-проектов через Чернокнижника\n`;
      message += `• <b>Особый контент</b> — отдельные ритуалы и материалы по решению Совета\n\n`;
      message += `😈 <b>При выборе сделки Чернокнижник сам предложит свиток, если сила Круга достаточна.</b>`;
    }
    
    const keyboard = [];
    
    if (totalScrolls > 0) {
      keyboard.push([
        Markup.button.callback('😈 Сделки с демонами', 'userKickstarters'),
        Markup.button.callback('📜 Использовать свиток', 'useScroll')
      ]);
    } else {
      keyboard.push([
        Markup.button.callback('😈 Сделки с демонами', 'userKickstarters')
      ]);
    }
    
    keyboard.push([
      Markup.button.callback('💰 Баланс и свитки', 'userBalanceScrolls'),
      Markup.button.callback(t('messages.back'), 'refreshUserStatus')
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });
    
  } catch (error) {
    console.error('Error in userScrolls:', error);
    await ctx.editMessageText(t('messages.try_again_later'), { 
      parse_mode: 'HTML', 
      ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.back'), 'refreshUserStatus')]]) 
    });
  }
});
