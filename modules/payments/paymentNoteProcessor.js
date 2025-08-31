const SETTINGS = require('../../settings.json');

/**
 * Payment Note Processor
 * Handles payment note validation and processing
 * Allows payment codes to be included anywhere in the note message
 */
class PaymentNoteProcessor {
  constructor() {
    this.validPaymentCodes = new Set(); // Store valid payment codes
    this.processedPayments = new Map(); // Track processed payments
  }

  /**
   * Add a valid payment code to the system
   * @param {string} paymentCode - 6-character payment code
   * @param {Object} paymentDetails - Payment details (userId, amount, type, etc.)
   */
  addValidPaymentCode(paymentCode, paymentDetails) {
    if (this.validatePaymentCodeFormat(paymentCode)) {
      this.validPaymentCodes.add(paymentCode);
      this.processedPayments.set(paymentCode, {
        ...paymentDetails,
        createdAt: new Date(),
        status: 'pending'
      });
      return true;
    }
    return false;
  }

  /**
   * Validate payment code format (6 characters, alphanumeric)
   * @param {string} paymentCode - Payment code to validate
   * @returns {boolean} - True if valid format
   */
  validatePaymentCodeFormat(paymentCode) {
    return /^[A-Z0-9]{6}$/.test(paymentCode);
  }

  /**
   * Process a payment note and extract payment code
   * @param {string} noteText - Payment note text from PayPal
   * @returns {Object|null} - Payment details if valid code found, null otherwise
   */
  processPaymentNote(noteText) {
    if (!noteText || typeof noteText !== 'string') {
      return null;
    }

    // Extract all potential 6-character codes from the note
    const potentialCodes = noteText.match(/[A-Z0-9]{6}/g) || [];
    
    for (const code of potentialCodes) {
      if (this.validPaymentCodes.has(code)) {
        const paymentDetails = this.processedPayments.get(code);
        if (paymentDetails && paymentDetails.status === 'pending') {
          return {
            paymentCode: code,
            noteText: noteText,
            ...paymentDetails
          };
        }
      }
    }

    return null;
  }

  /**
   * Mark a payment as processed
   * @param {string} paymentCode - Payment code to mark as processed
   * @returns {boolean} - True if successfully marked
   */
  markPaymentProcessed(paymentCode) {
    if (this.processedPayments.has(paymentCode)) {
      const payment = this.processedPayments.get(paymentCode);
      payment.status = 'processed';
      payment.processedAt = new Date();
      this.processedPayments.set(paymentCode, payment);
      return true;
    }
    return false;
  }

  /**
   * Get payment status
   * @param {string} paymentCode - Payment code to check
   * @returns {Object|null} - Payment details or null if not found
   */
  getPaymentStatus(paymentCode) {
    return this.processedPayments.get(paymentCode) || null;
  }

  /**
   * Get all pending payments
   * @returns {Array} - Array of pending payment details
   */
  getPendingPayments() {
    const pending = [];
    for (const [code, details] of this.processedPayments) {
      if (details.status === 'pending') {
        pending.push({ paymentCode: code, ...details });
      }
    }
    return pending;
  }

  /**
   * Get all processed payments
   * @returns {Array} - Array of processed payment details
   */
  getProcessedPayments() {
    const processed = [];
    for (const [code, details] of this.processedPayments) {
      if (details.status === 'processed') {
        processed.push({ paymentCode: code, ...details });
      }
    }
    return processed;
  }

  /**
   * Remove a payment code (e.g., if expired or invalid)
   * @param {string} paymentCode - Payment code to remove
   * @returns {boolean} - True if successfully removed
   */
  removePaymentCode(paymentCode) {
    if (this.validPaymentCodes.has(paymentCode)) {
      this.validPaymentCodes.delete(paymentCode);
      this.processedPayments.delete(paymentCode);
      return true;
    }
    return false;
  }

  /**
   * Clear expired payment codes (older than specified hours)
   * @param {number} hours - Hours after which codes expire
   * @returns {number} - Number of codes cleared
   */
  clearExpiredCodes(hours = 24) {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    let clearedCount = 0;

    for (const [code, details] of this.processedPayments) {
      if (details.createdAt < cutoffTime && details.status === 'pending') {
        this.removePaymentCode(code);
        clearedCount++;
      }
    }

    return clearedCount;
  }

  /**
   * Generate a unique 6-character payment code
   * @returns {string} - Generated payment code
   */
  generatePaymentCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.validPaymentCodes.has(code));
    
    return code;
  }

  /**
   * Get statistics about payment codes
   * @returns {Object} - Statistics object
   */
  getStats() {
    const total = this.processedPayments.size;
    const pending = this.getPendingPayments().length;
    const processed = this.getProcessedPayments().length;

    return {
      total,
      pending,
      processed,
      validCodes: this.validPaymentCodes.size
    };
  }
}

module.exports = PaymentNoteProcessor;
