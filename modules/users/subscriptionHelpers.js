const knex = require('../db/knex');

/**
 * Get current month period in YYYY_MM format
 */
function getCurrentMonthPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}_${month}`;
}

/**
 * Get next month period in YYYY_MM format
 */
function getNextMonthPeriod() {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const year = nextMonth.getFullYear();
  const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
  return `${year}_${month}`;
}

/**
 * Check user's subscription status for a specific period
 * @param {number} userId - User ID
 * @param {string} period - Period in YYYY_MM format (optional, defaults to current month)
 * @returns {Object} - { hasRegular: boolean, hasPlus: boolean, status: string }
 */
async function getUserSubscriptionStatus(userId, period = null) {
  try {
    const targetPeriod = period || getCurrentMonthPeriod();
    
    // Get user's subscriptions for the period
    const subscriptions = await knex('userGroups')
      .where('userId', Number(userId))
      .where('period', targetPeriod)
      .select('type');
    
    const hasRegular = subscriptions.some(sub => sub.type === 'regular');
    const hasPlus = subscriptions.some(sub => sub.type === 'plus');
    
    let status = 'unpaid';
    if (hasPlus) {
      status = 'paid_plus';
    } else if (hasRegular) {
      status = 'paid_regular';
    }
    
    return {
      hasRegular,
      hasPlus,
      status,
      period: targetPeriod
    };
  } catch (error) {
    console.error('Error checking user subscription status:', error);
    return {
      hasRegular: false,
      hasPlus: false,
      status: 'unpaid',
      period: period || getCurrentMonthPeriod()
    };
  }
}

/**
 * Get subscription status message for display
 * @param {Object} subscriptionStatus - Result from getUserSubscriptionStatus
 * @returns {string} - Formatted status message
 */
function getSubscriptionStatusMessage(subscriptionStatus) {
  const { status, period } = subscriptionStatus;
  
  // Format period for display (2025_12 -> December 2025)
  const [year, month] = period.split('_');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[parseInt(month) - 1];
  const displayPeriod = `${monthName} ${year}`;
  
  switch (status) {
    case 'paid_plus':
      return `✅ <b>${displayPeriod}</b> - Оплачен (➕ расширенная версия)`;
    case 'paid_regular':
      return `✅ <b>${displayPeriod}</b> - Оплачен (обычная версия)`;
    case 'unpaid':
    default:
      return `❌ <b>${displayPeriod}</b> - Не оплачен`;
  }
}

/**
 * Check if a month period exists in the months table
 * @param {string} period - Period in YYYY_MM format
 * @returns {boolean} - Whether the period exists
 */
async function monthPeriodExists(period) {
  try {
    const month = await knex('months')
      .where('period', period)
      .first();
    return !!month;
  } catch (error) {
    console.error('Error checking if month period exists:', error);
    return false;
  }
}

module.exports = {
  getCurrentMonthPeriod,
  getNextMonthPeriod,
  getUserSubscriptionStatus,
  getSubscriptionStatusMessage,
  monthPeriodExists
};
