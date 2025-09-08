/**
 * Message routing utilities to prevent modules from consuming messages they shouldn't handle
 */

/**
 * Check if a message should be handled by a specific module
 * @param {Object} ctx - Telegraf context
 * @param {string} moduleType - Type of module ('command', 'scene', 'search', etc.)
 * @param {Object} options - Additional options
 * @returns {boolean} - Whether the message should be handled
 */
function shouldHandleMessage(ctx, moduleType, options = {}) {
  const message = ctx.message;
  const callbackQuery = ctx.callbackQuery;
  
  // Handle callback queries
  if (callbackQuery) {
    return moduleType === 'callback';
  }
  
  // Handle messages
  if (message) {
    const text = message.text;
    
    // Commands should only be handled by command modules
    if (text && text.startsWith('/')) {
      return moduleType === 'command';
    }
    
    // Scene handlers should only work when user is in a scene
    if (moduleType === 'scene') {
      const sceneName = options.sceneName;
      if (sceneName && ctx.scene && ctx.scene.session) {
        return ctx.scene.session.current === sceneName;
      }
      return false;
    }
    
    // Search handlers should only work when user is in search mode
    if (moduleType === 'search') {
      return options.isSearchMode || false;
    }
    
    // Regular message handlers
    if (moduleType === 'message') {
      return true;
    }
  }
  
  return false;
}

/**
 * Create a safe message handler that only processes messages when appropriate
 * @param {string} moduleType - Type of module
 * @param {Function} handler - Handler function
 * @param {Object} options - Additional options
 * @returns {Function} - Safe handler function
 */
function createSafeHandler(moduleType, handler, options = {}) {
  return async (ctx, next) => {
    if (shouldHandleMessage(ctx, moduleType, options)) {
      return handler(ctx, next);
    } else {
      return next();
    }
  };
}

/**
 * Create a safe scene message handler
 * @param {string} sceneName - Name of the scene
 * @param {Function} handler - Handler function
 * @returns {Function} - Safe scene handler
 */
function createSafeSceneHandler(sceneName, handler) {
  return createSafeHandler('scene', handler, { sceneName });
}

/**
 * Create a safe search handler
 * @param {Function} handler - Handler function
 * @param {Function} isSearchMode - Function to check if user is in search mode
 * @returns {Function} - Safe search handler
 */
function createSafeSearchHandler(handler, isSearchMode) {
  return createSafeHandler('search', handler, { isSearchMode });
}

module.exports = {
  shouldHandleMessage,
  createSafeHandler,
  createSafeSceneHandler,
  createSafeSearchHandler
};
