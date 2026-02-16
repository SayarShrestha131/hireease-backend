import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import Booking from '../models/Booking';
import Vehicle from '../models/Vehicle';
import priceCalculatorService from '../services/priceCalculatorService';
import availabilityCheckerService from '../services/availabilityCheckerService';
import kycValidatorService from '../services/kycValidatorService';

/**
 * Calculate booking price
 * @route POST /api/bookings/calculate-price
 */
export const calculatePrice = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { vehicleId, pickupDate, dropoffDate, addOns } = req.body;

    // Validate inputs
    if (!vehicleId || !pickupDate || !dropoffDate) {
      res.status(400).json({
        success: false,
        error: 'Vehicle ID, pickup date, and dropoff date are required',
      });
      return;
    }

    // Validate date range
    const pickup = new Date(pickupDate);
    const dropoff = new Date(dropoffDate);
    
    if (!availabilityCheckerService.validateDateRange(pickup, dropoff)) {
      res.status(400).json({
        success: false,
        error: 'Invalid date range. Pickup date must be in the future and dropoff date must be after pickup date.',
      });
      return;
    }

    // Generate price breakdown using PriceCalculatorService
    const priceBreakdown = await priceCalculatorService.generatePriceBreakdown(
      vehicleId,
      pickup,
      dropoff,
      addOns || {}
    );

    res.status(200).json({
      success: true,
      data: {
        priceBreakdown,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Vehicle not found') {
      res.status(404).json({
        success: false,
        error: 'Vehicle not found',
      });
      return;
    }
    next(error);
  }
};

/**
 * Create new booking
 * @route POST /api/bookings/create
 */
export const createBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { vehicleId, pickupDate, dropoffDate, pickupTime, dropoffTime, addOns } = req.body;

    // Validate authentication
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Validate required fields
    if (!vehicleId || !pickupDate || !dropoffDate || !pickupTime || !dropoffTime) {
      res.status(400).json({
        success: false,
        error: 'Vehicle ID, pickup date, dropoff date, pickup time, and dropoff time are required',
      });
      return;
    }

    const pickup = new Date(pickupDate);
    const dropoff = new Date(dropoffDate);

    // Validate date range
    if (!availabilityCheckerService.validateDateRange(pickup, dropoff)) {
      res.status(400).json({
        success: false,
        error: 'Invalid date range. Pickup date must be in the future and dropoff date must be after pickup date.',
      });
      return;
    }

    // Validate KYC status using KYCValidatorService
    console.log(`\n🔐 KYC VALIDATION CHECK`);
    console.log(`⏰ Time: ${new Date().toISOString()}`);
    console.log(`👤 User ID: ${userId.toString()}`);
    
    const isKYCApproved = await kycValidatorService.validateUserKYC(userId.toString());
    
    console.log(`✅ KYC Approved: ${isKYCApproved}`);
    
    if (!isKYCApproved) {
      const kycStatus = await kycValidatorService.getKYCStatus(userId.toString());
      console.log(`📋 KYC Status: ${kycStatus.status}`);
      console.log(`❌ Booking rejected - KYC verification required\n`);
      
      res.status(403).json({
        success: false,
        error: 'KYC verification required. Please complete KYC verification before booking.',
        kycStatus,
      });
      return;
    }
    
    console.log(`✅ KYC validation passed - proceeding with booking\n`);

    // Check if vehicle exists
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      res.status(404).json({
        success: false,
        error: 'Vehicle not found',
      });
      return;
    }

    // Check vehicle availability using AvailabilityCheckerService
    const isAvailable = await availabilityCheckerService.checkVehicleAvailability(
      vehicleId,
      pickup,
      dropoff
    );

    if (!isAvailable) {
      const conflictingBookings = await availabilityCheckerService.getConflictingBookings(
        vehicleId,
        pickup,
        dropoff
      );
      
      res.status(409).json({
        success: false,
        error: 'Vehicle not available for selected dates',
        conflictingBookings: conflictingBookings.map(b => ({
          pickupDate: b.pickupDate,
          dropoffDate: b.dropoffDate,
        })),
      });
      return;
    }

    // Calculate price breakdown using PriceCalculatorService
    const priceBreakdown = await priceCalculatorService.generatePriceBreakdown(
      vehicleId,
      pickup,
      dropoff,
      addOns || {}
    );

    // Create booking record
    const booking = await Booking.create({
      userId,
      vehicleId,
      status: 'pending',
      pickupDate: pickup,
      dropoffDate: dropoff,
      pickupTime,
      dropoffTime,
      addOns: addOns || {},
      priceBreakdown,
      paymentStatus: 'pending',
    });

    // Populate vehicle details
    await booking.populate('vehicleId');

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: {
        booking,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm payment (simplified)
 * @route POST /api/bookings/:id/confirm-payment
 */
export const confirmPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    const { paymentMethod, paymentId } = req.body;

    // Validate authentication
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Validate payment method
    if (!paymentMethod) {
      res.status(400).json({
        success: false,
        error: 'Payment method is required',
      });
      return;
    }

    // Find booking
    const booking = await Booking.findById(id);
    
    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found',
      });
      return;
    }

    // Verify booking belongs to user
    if (booking.userId.toString() !== userId?.toString()) {
      res.status(403).json({
        success: false,
        error: 'Unauthorized access to booking',
      });
      return;
    }

    // Verify booking status is pending
    if (booking.status !== 'pending') {
      res.status(400).json({
        success: false,
        error: 'Booking is already processed',
      });
      return;
    }

    // Update booking status
    booking.status = 'confirmed';
    booking.paymentStatus = 'completed';
    booking.paymentMethod = paymentMethod;
    if (paymentId) {
      booking.paymentId = paymentId;
    }
    booking.paidAt = new Date();
    await booking.save();

    // Update vehicle availability to booked
    await Vehicle.findByIdAndUpdate(booking.vehicleId, {
      'availability.isAvailable': false,
    });

    // Populate vehicle details
    await booking.populate('vehicleId');

    res.status(200).json({
      success: true,
      message: 'Payment confirmed successfully',
      data: {
        booking,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's bookings with filtering and pagination
 * @route GET /api/bookings/my-bookings
 */
export const getUserBookings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;

    // Validate authentication
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Extract query parameters for filtering and pagination
    const { status, page = '1', limit = '10' } = req.query;

    // Build filter query
    const filter: any = { userId };
    
    // Add status filter if provided
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Parse pagination parameters
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const total = await Booking.countDocuments(filter);

    // Fetch bookings with pagination
    const bookings = await Booking.find(filter)
      .populate('vehicleId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Calculate pagination metadata
    const pages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get booking by ID with vehicle details population
 * @route GET /api/bookings/:id
 */
export const getBookingById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    // Validate authentication
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Find booking and populate vehicle details
    const booking = await Booking.findById(id).populate('vehicleId');

    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found',
      });
      return;
    }

    // Verify booking belongs to user
    if (booking.userId.toString() !== userId?.toString()) {
      res.status(403).json({
        success: false,
        error: 'Unauthorized access to booking',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        booking,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel booking with validation and refund handling
 * @route PUT /api/bookings/:id/cancel
 */
export const cancelBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    // Validate authentication
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Find booking
    const booking = await Booking.findById(id);

    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found',
      });
      return;
    }

    // Verify booking belongs to user
    if (booking.userId.toString() !== userId?.toString()) {
      res.status(403).json({
        success: false,
        error: 'Unauthorized access to booking',
      });
      return;
    }

    // Validate booking status - only pending or confirmed bookings can be cancelled
    if (booking.status !== 'pending' && booking.status !== 'confirmed') {
      res.status(400).json({
        success: false,
        error: 'Cannot cancel booking. Only pending or confirmed bookings can be cancelled.',
      });
      return;
    }

    // Validate pickup date is in the future
    const now = new Date();
    if (booking.pickupDate <= now) {
      res.status(400).json({
        success: false,
        error: 'Cannot cancel booking after pickup date has passed',
      });
      return;
    }

    // Update booking status to cancelled
    booking.status = 'cancelled';
    
    // Handle refund if payment was completed
    if (booking.paymentStatus === 'completed') {
      booking.paymentStatus = 'refunded';
    }
    
    await booking.save();

    // Release vehicle - set availability back to true
    await Vehicle.findByIdAndUpdate(booking.vehicleId, {
      'availability.isAvailable': true,
    });

    // Populate vehicle details
    await booking.populate('vehicleId');

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        booking,
      },
    });
  } catch (error) {
    next(error);
  }
};
