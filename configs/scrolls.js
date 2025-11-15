/**
 * Scrolls Configuration
 * 
 * Scrolls are bonus currency that allows users to get things for free (like promocodes)
 * Each scroll has:
 * - id: unique identifier (string)
 * - name: display name (string)
 * - priceThreshold: maximum price in Telegram Stars that this scroll can be used for
 */

module.exports = {
  scrolls: [
    {
      id: 'common',
      name: 'Обычный свиток',
      priceThreshold: 500 // Can be used for items up to 500 stars
    },
    {
      id: 'rare',
      name: 'Редкий свиток',
      priceThreshold: 1000 // Can be used for items up to 1000 stars
    },
    {
      id: 'epic',
      name: 'Эпический свиток',
      priceThreshold: 2000 // Can be used for items up to 2000 stars
    },
    {
      id: 'legendary',
      name: 'Легендарный свиток',
      priceThreshold: 5000 // Can be used for items up to 5000 stars
    }
  ]
};
