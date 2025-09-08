// Core RPG (loyalty) configuration

module.exports = {
  baseUnits: {
    regular: 600,
    plus: 1600,
    ksPerBackingCapUnits: 300
  },
  prices: {
    regularStars: process.env.REGULAR_PRICE ? Number(process.env.REGULAR_PRICE) : 0,
    plusStars: process.env.PLUS_PRICE ? Number(process.env.PLUS_PRICE) : 0
  },
  xp: {
    A: 173.8,
    B: 0.393
  },
  tiers: [
    { name: 'wood', min: 0, max: 1999 },
    { name: 'bronze', min: 2000, max: 4999 },
    { name: 'silver', min: 5000, max: 9999 },
    { name: 'gold', min: 10000, max: 19999 },
    { name: 'platinum', min: 20000, max: 39999 },
    { name: 'diamond', min: 40000, max: 79999 },
    { name: 'mithril', min: 80000, max: 159999 },
    { name: 'legend', min: 160000, max: Number.POSITIVE_INFINITY }
  ]
};


