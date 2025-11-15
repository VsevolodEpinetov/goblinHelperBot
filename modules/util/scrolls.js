const knex = require('../db/knex');
const scrollsConfig = require('../../configs/scrolls');
const { getUser } = require('../db/helpers');

/**
 * Give scroll to user
 * @param {number} userId - Telegram user ID
 * @param {string} scrollId - Scroll ID from config
 * @param {string} reason - Reason for giving scroll
 * @param {number|null} lifetime - Optional timestamp in ms when scroll expires
` * @returns {Promise<boolean>} - Success status
 */
async function giveScroll(userId, scrollId, reason, lifetime = null) {
  try {
    // Validate scroll ID
    const scrollDef = scrollsConfig.scrolls.find(s => s.id === scrollId);
    if (!scrollDef) {
      console.error(`❌ Invalid scroll ID: ${scrollId}`);
      return false;
    }

    // Get or create user scroll record
    const existing = await knex('userScrolls')
      .where({ userId, scrollId })
      .first();

    const lifetimeDate = lifetime ? new Date(lifetime) : null;

    if (existing) {
      // Update existing record
      await knex('userScrolls')
        .where({ userId, scrollId })
        .update({
          amount: knex.raw('amount + 1'),
          lifetime: lifetimeDate,
          updatedAt: knex.fn.now()
        });
    } else {
      // Create new record
      await knex('userScrolls').insert({
        userId,
        scrollId,
        amount: 1,
        lifetime: lifetimeDate,
        createdAt: knex.fn.now(),
        updatedAt: knex.fn.now()
      });
    }

    // Log the action
    await knex('scrollLogs').insert({
      userId,
      scrollId,
      action: 'add',
      amount: 1,
      reason: reason || 'No reason provided',
      createdAt: knex.fn.now()
    });

    // Send notification to user
    const userData = await getUser(userId);
    if (userData && globalThis.__bot) {
      const lifetimeText = lifetimeDate ? 
        `\n\n⏰ Срок действия: до ${lifetimeDate.toLocaleDateString('ru-RU')}` : '';
      
      await globalThis.__bot.telegram.sendMessage(
        userId,
        `📜 <b>Получен свиток!</b>\n\n` +
        `Ты получил: <b>${scrollDef.name}</b>\n` +
        `Причина: ${reason || 'Бонус'}${lifetimeText}`,
        { parse_mode: 'HTML' }
      );
    }

    return true;
  } catch (error) {
    console.error('❌ Error giving scroll:', error);
    return false;
  }
}

/**
 * Remove scrolls from user
 * @param {number} userId - Telegram user ID
 * @param {string} scrollId - Scroll ID from config
 * @param {number} amount - Amount to remove
 * @param {string} reason - Reason for removal
 * @returns {Promise<boolean>} - Success status
 */
async function removeScrolls(userId, scrollId, amount, reason) {
  try {
    const existing = await knex('userScrolls')
      .where({ userId, scrollId })
      .first();

    if (!existing || existing.amount < amount) {
      console.error(`❌ Not enough scrolls to remove. User has ${existing?.amount || 0}, trying to remove ${amount}`);
      return false;
    }

    const newAmount = existing.amount - amount;

    if (newAmount === 0) {
      // Remove record if amount reaches zero
      await knex('userScrolls')
        .where({ userId, scrollId })
        .del();
    } else {
      // Update amount
      await knex('userScrolls')
        .where({ userId, scrollId })
        .update({
          amount: newAmount,
          updatedAt: knex.fn.now()
        });
    }

    // Log the action
    await knex('scrollLogs').insert({
      userId,
      scrollId,
      action: 'remove',
      amount,
      reason: reason || 'No reason provided',
      createdAt: knex.fn.now()
    });

    return true;
  } catch (error) {
    console.error('❌ Error removing scrolls:', error);
    return false;
  }
}

/**
 * Remove all scrolls from user
 * @param {number} userId - Telegram user ID
 * @param {string|null} scrollId - Optional scroll ID. If not specified, removes all scrolls
 * @returns {Promise<boolean>} - Success status
 */
async function removeAllScrolls(userId, scrollId = null) {
  try {
    if (scrollId) {
      // Remove specific scroll type
      const existing = await knex('userScrolls')
        .where({ userId, scrollId })
        .first();

      if (existing) {
        await knex('scrollLogs').insert({
          userId,
          scrollId,
          action: 'remove',
          amount: existing.amount,
          reason: 'All scrolls removed',
          createdAt: knex.fn.now()
        });

        await knex('userScrolls')
          .where({ userId, scrollId })
          .del();
      }
    } else {
      // Remove all scrolls
      const allScrolls = await knex('userScrolls')
        .where({ userId })
        .select('scrollId', 'amount');

      // Log each removal
      for (const scroll of allScrolls) {
        await knex('scrollLogs').insert({
          userId,
          scrollId: scroll.scrollId,
          action: 'remove',
          amount: scroll.amount,
          reason: 'All scrolls removed',
          createdAt: knex.fn.now()
        });
      }

      await knex('userScrolls')
        .where({ userId })
        .del();
    }

    return true;
  } catch (error) {
    console.error('❌ Error removing all scrolls:', error);
    return false;
  }
}

/**
 * Get all user scrolls
 * @param {number} userId - Telegram user ID
 * @returns {Promise<Array>} - Array of scroll objects with scrollId, amount, lifetime
 */
async function getUserScrolls(userId) {
  try {
    const scrolls = await knex('userScrolls')
      .where({ userId })
      .select('scrollId', 'amount', 'lifetime')
      .orderBy('scrollId');

    // Filter out expired scrolls
    const now = new Date();
    const validScrolls = scrolls.filter(s => {
      if (!s.lifetime) return true;
      return new Date(s.lifetime) > now;
    });

    // Remove expired scrolls from database
    const expiredScrolls = scrolls.filter(s => {
      if (!s.lifetime) return false;
      return new Date(s.lifetime) <= now;
    });

    for (const expired of expiredScrolls) {
      await knex('userScrolls')
        .where({ userId, scrollId: expired.scrollId })
        .del();
    }

    return validScrolls.map(s => ({
      scrollId: s.scrollId,
      amount: s.amount,
      lifetime: s.lifetime ? new Date(s.lifetime) : null,
      scrollDef: scrollsConfig.scrolls.find(sc => sc.id === s.scrollId)
    }));
  } catch (error) {
    console.error('❌ Error getting user scrolls:', error);
    return [];
  }
}

/**
 * Check if user can use scroll for given price
 * @param {number} userId - Telegram user ID
 * @param {string} scrollId - Scroll ID from config
 * @param {number} price - Price in Telegram Stars
 * @returns {Promise<boolean>} - Whether scroll can be used
 */
async function canUseScroll(userId, scrollId, price) {
  try {
    const scrollDef = scrollsConfig.scrolls.find(s => s.id === scrollId);
    if (!scrollDef) {
      return false;
    }

    // Check if price is within threshold
    if (price > scrollDef.priceThreshold) {
      return false;
    }

    // Check if user has this scroll
    const userScroll = await knex('userScrolls')
      .where({ userId, scrollId })
      .first();

    if (!userScroll || userScroll.amount === 0) {
      return false;
    }

    // Check if scroll is expired
    if (userScroll.lifetime) {
      const now = new Date();
      if (new Date(userScroll.lifetime) <= now) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Error checking scroll usage:', error);
    return false;
  }
}

/**
 * Get usable scrolls for a given price
 * @param {number} userId - Telegram user ID
 * @param {number} price - Price in Telegram Stars
 * @returns {Promise<Array>} - Array of scroll objects that can be used
 */
async function getUsableScrolls(userId, price) {
  try {
    const userScrolls = await getUserScrolls(userId);
    const usable = [];

    for (const scroll of userScrolls) {
      if (scroll.scrollDef && price <= scroll.scrollDef.priceThreshold && scroll.amount > 0) {
        usable.push(scroll);
      }
    }

    return usable;
  } catch (error) {
    console.error('❌ Error getting usable scrolls:', error);
    return [];
  }
}

module.exports = {
  giveScroll,
  removeScrolls,
  removeAllScrolls,
  getUserScrolls,
  canUseScroll,
  getUsableScrolls
};
