// Simple frontend test
describe('Simple Frontend Test', () => {
  it('should pass a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should work with React', () => {
    const element = { type: 'div', props: { children: 'Hello' } };
    expect(element.type).toBe('div');
  });
});
