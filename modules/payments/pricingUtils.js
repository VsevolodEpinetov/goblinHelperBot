/**
 * Pricing utility functions for payment services
 */

/**
 * Check if a user is a test user and apply test pricing
 * @param {number} userId - User ID to check
 * @param {number} calculatedPrice - Price after all other discounts
 * @returns {number} - Final price (1 star if test user, otherwise calculated price)
 */
function applyTestUserPricing(userId, calculatedPrice) {
  const testUserId = process.env.TEST_USER_ID;
  
  if (testUserId && Number(userId) === Number(testUserId)) {
    return 1;
  }
  
  return calculatedPrice;
}

/**
 * Check if a user is a test user
 * @param {number} userId - User ID to check
 * @returns {boolean} - True if user is a test user
 */
function isTestUser(userId) {
  const testUserId = process.env.TEST_USER_ID;
  return testUserId && Number(userId) === Number(testUserId);
}

module.exports = {
  applyTestUserPricing,
  isTestUser
};

