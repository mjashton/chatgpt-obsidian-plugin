import { jest } from '@jest/globals';

// Mock global console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidFilePath(): R;
    }
  }
}

expect.extend({
  toBeValidFilePath(received: string) {
    const isValid = received && 
      !received.includes('\\') && 
      !received.includes(':') && 
      !received.includes('*') && 
      !received.includes('?') && 
      !received.includes('"') && 
      !received.includes('<') && 
      !received.includes('>') && 
      !received.includes('|');
    
    return {
      message: () => `expected ${received} to be a valid file path`,
      pass: isValid,
    };
  },
});
