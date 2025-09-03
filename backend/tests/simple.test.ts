// Simple test to verify Jest is working
describe('Simple Test Suite', () => {
  it('should pass a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle async operations', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });

  it('should work with environment variables', () => {
    process.env.NODE_ENV = 'test';
    expect(process.env.NODE_ENV).toBe('test');
  });
});
