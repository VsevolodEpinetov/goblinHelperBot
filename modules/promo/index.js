// Promo module - exports the service
// Actions are handled in modules/users/actions/getPromoFile.js
// Commands are handled in modules/admin/commands/promoManagement.js

module.exports = {
  // Export the promo service for use by other modules
  promoService: require('./promoService')
};
