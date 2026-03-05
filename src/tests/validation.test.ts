describe('Input Validation', () => {
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  const validatePassword = (password: string): boolean => {
    // At least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  };
  
  const validateLicenseNumber = (license: string): boolean => {
    // Format: XX-XX-XXXXXXXX
    const licenseRegex = /^\d{2}-\d{2}-\d{8}$/;
    return licenseRegex.test(license);
  };
  
  const validateDateRange = (pickup: Date, dropoff: Date): boolean => {
    return dropoff > pickup;
  };
  
  test('should validate email format', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('invalid-email')).toBe(false);
    expect(validateEmail('test@')).toBe(false);
  });
  
  test('should validate password strength', () => {
    expect(validatePassword('Test@123456')).toBe(true);
    expect(validatePassword('weak')).toBe(false);
    expect(validatePassword('NoSpecialChar123')).toBe(false);
  });
  
  test('should validate license number format', () => {
    expect(validateLicenseNumber('04-06-01018658')).toBe(true);
    expect(validateLicenseNumber('invalid')).toBe(false);
  });
  
  test('should validate date range', () => {
    const pickup = new Date('2026-02-21');
    const dropoff = new Date('2026-02-23');
    
    expect(validateDateRange(pickup, dropoff)).toBe(true);
    expect(validateDateRange(dropoff, pickup)).toBe(false);
  });
});
