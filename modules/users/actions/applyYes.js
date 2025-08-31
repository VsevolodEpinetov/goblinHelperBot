const { Composer } = require('telegraf');
const { t } = require('../../../modules/i18n');
const { safeCreatePage } = require('../../integrations/notion');
const SETTINGS = require('../../../settings.json');

module.exports = Composer.action('applyYes', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  const userId = ctx.from.id;
  const userInfo = ctx.from;
  
  try {
    // 1. Create entry in Notion database
    if (safeCreatePage) {
      const notionProperties = {
        'User ID': {
          title: [
            {
              text: {
                content: String(userId)
              }
            }
          ]
        },
        'First Name': {
          rich_text: [
            {
              text: {
                content: userInfo.first_name || 'Not provided'
              }
            }
          ]
        },
        'Last Name': {
          rich_text: [
            {
              text: {
                content: userInfo.last_name || 'Not provided'
              }
            }
          ]
        },
        'Username': {
          rich_text: [
            {
              text: {
                content: userInfo.username || 'Not provided'
              }
            }
          ]
        },
        'Status': {
          status: {
            name: 'Pending'
          }
        },
        'Date Applied': {
          date: {
            start: new Date().toISOString()
          }
        },
      };
      
      await safeCreatePage(notionProperties);
    }
    
    // 2. Send notification to admin
    const adminMessage = t('apply.adminNotification', {
      userId: userId,
      firstName: userInfo.first_name || 'Not provided',
      lastName: userInfo.last_name || 'Not provided',
      username: userInfo.username || 'Not provided',
      date: new Date().toLocaleString('ru-RU')
    });
    
    // Send to admin chat (you can configure which admin receives these)
    await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, adminMessage, { parse_mode: 'HTML' });
    
    // 3. Confirm to user
    await ctx.editMessageText(t('apply.sent'), {
      parse_mode: 'HTML'
    });
    
  } catch (error) {
    console.error('Error in applyYes:', error);
    await ctx.editMessageText(t('apply.error'), {
      parse_mode: 'HTML'
    });
  }
});
