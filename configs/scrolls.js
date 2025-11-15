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
      name: 'Свиток Малого Круга',
      priceThreshold: 150 // Can be used for items up to 150 stars
    },
    {
      id: 'rare',
      name: 'Свиток Срединного Круга',
      priceThreshold: 300 // Can be used for items up to 300 stars
    },
    {
      id: 'epic',
      name: 'Свиток Старшего Круга',
      priceThreshold: 450 // Can be used for items up to 450 stars
    },
    {
      id: 'legendary',
      name: 'Свиток Безымянного Круга',
      priceThreshold: 700 // Can be used for items up to 700 stars
    }
  ]
};
