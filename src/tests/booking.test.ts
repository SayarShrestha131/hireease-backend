describe('Booking Price Calculation', () => {
  const calculateBasePrice = (pricePerDay: number, days: number): number => {
    return pricePerDay * days;
  };
  
  const calculateAddOns = (addOns: any, days: number): number => {
    let total = 0;
    if (addOns.helmet) total += 50 * days;
    if (addOns.gps) total += 100 * days;
    if (addOns.insurance) total += 200 * days;
    return total;
  };
  
  const calculateTax = (subtotal: number): number => {
    return subtotal * 0.13; // 13% tax
  };
  
  const calculateServiceFee = (subtotal: number): number => {
    return subtotal * 0.0565; // 5.65% service fee
  };
  
  const calculateTotalPrice = (params: any) => {
    const basePrice = calculateBasePrice(params.pricePerDay, params.days);
    const addOnsTotal = calculateAddOns(params.addOns, params.days);
    const subtotal = basePrice + addOnsTotal;
    const tax = calculateTax(subtotal);
    const serviceFee = calculateServiceFee(subtotal);
    const totalPrice = subtotal + tax + serviceFee;
    
    return {
      basePrice,
      addOnsTotal,
      tax,
      serviceFee,
      totalPrice
    };
  };
  
  test('should calculate base price correctly', () => {
    const pricePerDay = 5000;
    const days = 2;
    const basePrice = calculateBasePrice(pricePerDay, days);
    
    expect(basePrice).toBe(10000);
  });
  
  test('should calculate add-ons correctly', () => {
    const addOns = { helmet: true, gps: false, insurance: false };
    const days = 2;
    const addOnsTotal = calculateAddOns(addOns, days);
    
    expect(addOnsTotal).toBe(100); // Helmet: 50 * 2 days
  });
  
  test('should calculate tax correctly', () => {
    const subtotal = 10100;
    const tax = calculateTax(subtotal);
    
    expect(tax).toBeCloseTo(1313, 0);
  });
  
  test('should calculate total price correctly', () => {
    const breakdown = calculateTotalPrice({
      pricePerDay: 5000,
      days: 2,
      addOns: { helmet: true, gps: false, insurance: false }
    });
    
    expect(breakdown.basePrice).toBe(10000);
    expect(breakdown.addOnsTotal).toBe(100);
    expect(breakdown.tax).toBeCloseTo(1313, 0);
    expect(breakdown.totalPrice).toBeCloseTo(11983.65, 2);
  });
});
