// Achievements catalog

module.exports = {
  years_of_service: {
    title: 'За выслугу лет',
    description: '50% стоимости подписки',
    multiplier: 0.5,
    appliesTo: ['subscription']
  },
  sbp_payment: {
    title: 'СБП Плательщик',
    description: 'Доступ к оплате через СБП',
    multiplier: 1.0,
    appliesTo: ['payment_method']
  }
};


