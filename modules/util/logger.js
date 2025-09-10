/**
 * Clean logging utility for specific bot events
 */

/**
 * Log RPG events (XP gains, level changes)
 */
function logRPG(userId, username, xpGained, reason, currentLevel, newXp, xpToNext) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  console.log(`${timeStr} [RPG] User @${username || 'unknown'} (${userId}) got ${xpGained}XP. Reason: ${reason}. Current level: ${currentLevel}, new xp: ${newXp}, xp to the next level: ${xpToNext}`);
}

/**
 * Log subscription events (invoices, payments)
 */
function logSubs(userId, username, action, details) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  console.log(`${timeStr} [SUBS] User @${username || 'unknown'} (${userId}) ${action} ${details}`);
}

/**
 * Log denied access events
 */
function logDenied(userId, username, command, reason, location = 'DMs') {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  console.log(`${timeStr} [DENIED] User @${username || 'unknown'} (${userId}) used ${command}, but was denied due to: ${reason} in the ${location}`);
}

/**
 * Log payment events
 */
function logPayment(userId, username, action, amount, currency = 'XTR') {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  console.log(`${timeStr} [PAYMENT] User @${username || 'unknown'} (${userId}) ${action} ${amount}${currency}`);
}

/**
 * Log admin actions
 */
function logAdmin(userId, username, action, details) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  console.log(`${timeStr} [ADMIN] User @${username || 'unknown'} (${userId}) ${action} ${details}`);
}

module.exports = {
  logRPG,
  logSubs,
  logDenied,
  logPayment,
  logAdmin
};
