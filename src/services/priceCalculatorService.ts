import Vehicle from '../models/Vehicle';
import { IAddOns, IPriceBreakdown } from '../models/Booking';

/**
 * Price Calculator Service
 * Handles all pricing calculations for vehicle bookings including
 * base price, duration discounts, add-ons, taxes, and service fees
 */
class PriceCalculatorService {
  // Pricing constants
  private readonly VAT_RATE = 0.13; // 13% VAT
  private readonly SERVICE_FEE_RATE = 0.05; // 5% service fee
  
  // Add-on rates (per day)
  private readonly HELMET_RATE = 50;
  private readonly GPS_RATE = 100;
  private readonly INSURANCE_RATE = 200;
  
  // Duration discount tiers
  private readonly DISCOUNT_7_DAYS = 0.10; // 10% off for 7-13 days
  private readonly DISCOUNT_14_DAYS = 0.15; // 15% off for 14-29 days
  private readonly DISCOUNT_30_DAYS = 0.20; // 20% off for 30+ days

  /**
   * Calculate the number of rental days between pickup and dropoff dates
   * @param pickupDate - Start date of rental
   * @param dropoffDate - End date of rental
   * @returns Number of days (minimum 1)
   */
  calculateDuration(pickupDate: Date, dropoffDate: Date): number {
    const pickup = new Date(pickupDate);
    const dropoff = new Date(dropoffDate);
    
    // Calculate difference in milliseconds
    const diffTime = Math.abs(dropoff.getTime() - pickup.getTime());
    
    // Convert to days and round up (minimum 1 day)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(diffDays, 1);
  }

  /**
   * Calculate base price (vehicle price per day × duration)
   * @param pricePerDay - Vehicle's daily rental rate
   * @param duration - Number of rental days
   * @returns Base price before discounts
   */
  calculateBasePrice(pricePerDay: number, duration: number): number {
    return pricePerDay * duration;
  }

  /**
   * Calculate duration discount based on rental length
   * @param basePrice - Base price before discount
   * @param duration - Number of rental days
   * @returns Discount amount
   */
  calculateDurationDiscount(basePrice: number, duration: number): number {
    let discountRate = 0;
    
    if (duration >= 30) {
      discountRate = this.DISCOUNT_30_DAYS;
    } else if (duration >= 14) {
      discountRate = this.DISCOUNT_14_DAYS;
    } else if (duration >= 7) {
      discountRate = this.DISCOUNT_7_DAYS;
    }
    
    return basePrice * discountRate;
  }

  /**
   * Calculate total cost for selected add-ons
   * @param addOns - Selected add-ons object
   * @param duration - Number of rental days
   * @returns Total add-ons cost
   */
  calculateAddOnsCost(addOns: IAddOns, duration: number): number {
    let total = 0;
    
    if (addOns.helmet) {
      total += this.HELMET_RATE * duration;
    }
    
    if (addOns.gps) {
      total += this.GPS_RATE * duration;
    }
    
    if (addOns.insurance) {
      total += this.INSURANCE_RATE * duration;
    }
    
    return total;
  }

  /**
   * Calculate VAT (13% of subtotal)
   * @param subtotal - Sum of discounted base price and add-ons
   * @returns VAT amount
   */
  calculateTax(subtotal: number): number {
    return subtotal * this.VAT_RATE;
  }

  /**
   * Calculate service fee (5% of subtotal + tax)
   * @param subtotal - Sum of discounted base price and add-ons
   * @param tax - VAT amount
   * @returns Service fee amount
   */
  calculateServiceFee(subtotal: number, tax: number): number {
    return (subtotal + tax) * this.SERVICE_FEE_RATE;
  }

  /**
   * Generate complete price breakdown for a booking
   * @param vehicleId - ID of the vehicle to book
   * @param pickupDate - Start date of rental
   * @param dropoffDate - End date of rental
   * @param addOns - Selected add-ons
   * @returns Complete price breakdown
   */
  async generatePriceBreakdown(
    vehicleId: string,
    pickupDate: Date,
    dropoffDate: Date,
    addOns: IAddOns = {}
  ): Promise<IPriceBreakdown> {
    // Fetch vehicle to get price per day
    const vehicle = await Vehicle.findById(vehicleId);
    
    if (!vehicle) {
      throw new Error('Vehicle not found');
    }
    
    // Calculate duration
    const duration = this.calculateDuration(pickupDate, dropoffDate);
    
    // Calculate base price
    const basePrice = this.calculateBasePrice(vehicle.pricePerDay, duration);
    
    // Calculate duration discount
    const durationDiscount = this.calculateDurationDiscount(basePrice, duration);
    
    // Calculate add-ons cost
    const addOnsTotal = this.calculateAddOnsCost(addOns, duration);
    
    // Calculate subtotal (base price - discount + add-ons)
    const subtotal = basePrice - durationDiscount + addOnsTotal;
    
    // Calculate tax (VAT)
    const tax = this.calculateTax(subtotal);
    
    // Calculate service fee
    const serviceFee = this.calculateServiceFee(subtotal, tax);
    
    // Calculate total price
    const totalPrice = subtotal + tax + serviceFee;
    
    return {
      basePrice: Math.round(basePrice * 100) / 100,
      duration,
      durationDiscount: Math.round(durationDiscount * 100) / 100,
      addOnsTotal: Math.round(addOnsTotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      serviceFee: Math.round(serviceFee * 100) / 100,
      totalPrice: Math.round(totalPrice * 100) / 100,
    };
  }
}

export default new PriceCalculatorService();
