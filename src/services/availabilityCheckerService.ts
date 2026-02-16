import Vehicle from '../models/Vehicle';
import Booking, { IBooking } from '../models/Booking';
import mongoose from 'mongoose';

/**
 * Availability Checker Service
 * Handles vehicle availability validation and booking conflict detection
 */
class AvailabilityCheckerService {
  /**
   * Validate that date range is valid
   * @param pickupDate - Start date of rental
   * @param dropoffDate - End date of rental
   * @returns true if valid, false otherwise
   */
  validateDateRange(pickupDate: Date, dropoffDate: Date): boolean {
    const pickup = new Date(pickupDate);
    const dropoff = new Date(dropoffDate);
    const now = new Date();
    
    // Check if pickup date is in the future
    if (pickup <= now) {
      return false;
    }
    
    // Check if dropoff date is after pickup date
    if (dropoff <= pickup) {
      return false;
    }
    
    return true;
  }

  /**
   * Get all bookings that conflict with the requested date range
   * @param vehicleId - ID of the vehicle
   * @param pickupDate - Start date of rental
   * @param dropoffDate - End date of rental
   * @returns Array of conflicting bookings
   */
  async getConflictingBookings(
    vehicleId: string,
    pickupDate: Date,
    dropoffDate: Date
  ): Promise<IBooking[]> {
    const pickup = new Date(pickupDate);
    const dropoff = new Date(dropoffDate);
    
    // Find bookings that overlap with the requested date range
    // A booking conflicts if:
    // 1. It's for the same vehicle
    // 2. Status is 'confirmed' or 'active'
    // 3. Date ranges overlap:
    //    - New pickup is before existing dropoff AND
    //    - New dropoff is after existing pickup
    const conflictingBookings = await Booking.find({
      vehicleId: new mongoose.Types.ObjectId(vehicleId),
      status: { $in: ['confirmed', 'active'] },
      $or: [
        {
          // Case 1: New booking starts during existing booking
          pickupDate: { $lte: pickup },
          dropoffDate: { $gt: pickup },
        },
        {
          // Case 2: New booking ends during existing booking
          pickupDate: { $lt: dropoff },
          dropoffDate: { $gte: dropoff },
        },
        {
          // Case 3: New booking completely contains existing booking
          pickupDate: { $gte: pickup },
          dropoffDate: { $lte: dropoff },
        },
      ],
    });
    
    return conflictingBookings;
  }

  /**
   * Check if a vehicle is available for the requested date range
   * @param vehicleId - ID of the vehicle
   * @param pickupDate - Start date of rental
   * @param dropoffDate - End date of rental
   * @returns true if available, false otherwise
   */
  async checkVehicleAvailability(
    vehicleId: string,
    pickupDate: Date,
    dropoffDate: Date
  ): Promise<boolean> {
    // Validate date range
    if (!this.validateDateRange(pickupDate, dropoffDate)) {
      return false;
    }
    
    // Check if vehicle exists
    const vehicle = await Vehicle.findById(vehicleId);
    
    if (!vehicle) {
      return false;
    }
    
    // Check base availability status
    if (!vehicle.availability.isAvailable) {
      return false;
    }
    
    // Check for conflicting bookings
    const conflicts = await this.getConflictingBookings(
      vehicleId,
      pickupDate,
      dropoffDate
    );
    
    // Vehicle is available if there are no conflicts
    return conflicts.length === 0;
  }
}

export default new AvailabilityCheckerService();
