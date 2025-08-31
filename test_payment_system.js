const PaymentNoteProcessor = require('./modules/payments/paymentNoteProcessor');

// Mock bot context for testing
const mockCtx = {
  users: {
    list: {
      123: {
        id: 123,
        username: 'testuser',
        roles: ['user'],
        balance: 0
      },
      456: {
        id: 456,
        username: 'admin',
        roles: ['admin'],
        balance: 0
      }
    }
  },
  paymentCodes: new Map(),
  paymentNoteProcessor: null
};

// Initialize payment processor
mockCtx.paymentNoteProcessor = new PaymentNoteProcessor();

// Test function
async function testPaymentSystem() {
  console.log('🧪 Тестирование системы платежей\n');

  // Test 1: Add valid payment codes
  console.log('1. Добавление кодов платежей...');
  mockCtx.paymentNoteProcessor.addValidPaymentCode('ABC123', {
    userId: 123,
    username: 'testuser',
    amount: 1000,
    type: 'balance',
    description: 'Test payment'
  });

  mockCtx.paymentNoteProcessor.addValidPaymentCode('XYZ789', {
    userId: 123,
    username: 'testuser',
    amount: 500,
    type: 'premium',
    description: 'Premium subscription'
  });

  console.log('✅ Коды добавлены\n');

  // Test 2: Check payment codes
  console.log('2. Проверка кодов платежей...');
  const codes = mockCtx.paymentNoteProcessor.getValidPaymentCodes();
  console.log('Доступные коды:', Array.from(codes.keys()));
  console.log('✅ Проверка завершена\n');

  // Test 3: Process payment note
  console.log('3. Обработка платежной заметки...');
  const result1 = await mockCtx.paymentNoteProcessor.processPaymentNote('ABC123', 'Payment for ABC123');
  console.log('Результат обработки ABC123:', result1);

  const result2 = await mockCtx.paymentNoteProcessor.processPaymentNote('XYZ789', 'Premium payment XYZ789');
  console.log('Результат обработки XYZ789:', result2);
  console.log('✅ Обработка завершена\n');

  // Test 4: Check processed payments
  console.log('4. Проверка обработанных платежей...');
  const processed = mockCtx.paymentNoteProcessor.getProcessedPayments();
  console.log('Обработанные платежи:', Array.from(processed.keys()));
  console.log('✅ Проверка завершена\n');

  // Test 5: Test invalid scenarios
  console.log('5. Тестирование некорректных сценариев...');
  
  // Invalid code
  const invalidResult = await mockCtx.paymentNoteProcessor.processPaymentNote('INVALID', 'Invalid payment');
  console.log('Некорректный код:', invalidResult);

  // Already processed code
  const duplicateResult = await mockCtx.paymentNoteProcessor.processPaymentNote('ABC123', 'Duplicate payment');
  console.log('Повторная обработка:', duplicateResult);
  console.log('✅ Тестирование завершено\n');

  // Test 6: Payment code validation
  console.log('6. Валидация форматов кодов...');
  const validCodes = ['ABC123', 'XYZ789', '123ABC', 'DEF456'];
  const invalidCodes = ['ABC12', 'ABCDEFG', 'ABC-12', 'ABC 12'];

  console.log('Валидные коды:');
  validCodes.forEach(code => {
    const isValid = mockCtx.paymentNoteProcessor.validatePaymentCodeFormat(code);
    console.log(`  ${code}: ${isValid ? '✅' : '❌'}`);
  });

  console.log('\nНекорректные коды:');
  invalidCodes.forEach(code => {
    const isValid = mockCtx.paymentNoteProcessor.validatePaymentCodeFormat(code);
    console.log(`  ${code}: ${isValid ? '✅' : '❌'}`);
  });

  console.log('\n🎉 Тестирование системы платежей завершено!');
}

// Run tests
testPaymentSystem().catch(console.error);
