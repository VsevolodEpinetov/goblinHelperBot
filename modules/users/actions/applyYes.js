const { Composer, Markup } = require('telegraf');
const { t } = require('../../../modules/i18n');
const { safeCreatePage } = require('../../integrations/notion');
const SETTINGS = require('../../../settings.json');
const knex = require('../../../modules/db/knex');
const { updateUser } = require('../../db/helpers');

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
    
    // 2. Save user to database with pending status
    const userData = {
      id: userId,
      username: userInfo.username || 'not_set',
      first_name: userInfo.first_name,
      last_name: userInfo.last_name || '',
      dateAdded: new Date().toISOString(),
      roles: [],
      purchases: {
        kickstarters: [],
        groups: {
          regular: [],
          plus: [],
          special: []
        },
        collections: [],
        balance: 0,
        releases: {},
        ticketsSpent: 0
      }
    };

    await updateUser(userId, userData);

    // Save to database via Knex
    try {
      const baseUser = {
        id: Number(userId),
        username: userInfo.username || null,
        firstName: userInfo.first_name || null,
        lastName: userInfo.last_name || null
      };
      await knex('users').insert(baseUser)
        .onConflict('id').merge(baseUser);

      await knex('userPurchases').insert({ userId: Number(userId), balance: 0, ticketsSpent: 0 })
        .onConflict('userId').merge();

      await knex('applications').insert({
        userId: Number(userId),
        username: userInfo.username || null,
        firstName: userInfo.first_name || null,
        lastName: userInfo.last_name || null,
        status: 'pending'
      });
    } catch (e) {
      console.log('Failed to save user/application via Knex', e);
    }
    
    // 3. Send notification to admin with Accept/Deny buttons
    const adminMessage = t('apply.adminNotification', {
      userId: userId,
      firstName: userInfo.first_name || 'Not provided',
      lastName: userInfo.last_name || 'Not provided',
      username: userInfo.username || 'Not provided',
      date: new Date().toLocaleString('ru-RU')
    });
    
    await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, adminMessage, { 
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Accept', `apply_admin_accept_${userId}`),
          Markup.button.callback('❌ Deny', `apply_admin_deny_${userId}`)
        ]
      ])
    });
    
    // 4. Confirm to user
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
