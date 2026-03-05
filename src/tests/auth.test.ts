import bcrypt from 'bcryptjs';

describe('Authentication Service - Password Hashing', () => {
  test('should hash password correctly', async () => {
    const password = 'Test@123456';
    const hashed = await bcrypt.hash(password, 10);
    
    expect(hashed).toBeDefined();
    expect(hashed).not.toBe(password);
    expect(hashed.length).toBeGreaterThan(50);
  });
  
  test('should verify correct password', async () => {
    const password = 'Test@123456';
    const hashed = await bcrypt.hash(password, 10);
    const isValid = await bcrypt.compare(password, hashed);
    
    expect(isValid).toBe(true);
  });
  
  test('should reject incorrect password', async () => {
    const password = 'Test@123456';
    const wrongPassword = 'Wrong@123456';
    const hashed = await bcrypt.hash(password, 10);
    const isValid = await bcrypt.compare(wrongPassword, hashed);
    
    expect(isValid).toBe(false);
  });
});

describe('JWT Token Service', () => {
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  
  test('should generate valid JWT token', () => {
    const userId = '699305f14acf182f1692d382';
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });
  
  test('should verify valid token', () => {
    const userId = '699305f14acf182f1692d382';
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    expect(decoded.userId).toBe(userId);
  });
  
  test('should reject invalid token', () => {
    const invalidToken = 'invalid.token.here';
    
    expect(() => jwt.verify(invalidToken, JWT_SECRET)).toThrow();
  });
});
