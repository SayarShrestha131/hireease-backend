import { Router } from 'express';
import {
  calculatePrice,
  createBooking,
  confirmPayment,
  getUserBookings,
  getBookingById,
  cancelBooking,
} from '../controllers/bookingController';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * @route   POST /api/bookings/calculate-price
 * @desc    Calculate booking price with breakdown
 * @access  Public
 */
router.post('/calculate-price', calculatePrice);

/**
 * @route   POST /api/bookings/create
 * @desc    Create a new booking
 * @access  Private (requires authentication)
 */
router.post('/create', authenticate, createBooking);

/**
 * @route   POST /api/bookings/:id/confirm-payment
 * @desc    Confirm payment for a booking
 * @access  Private (requires authentication)
 */
router.post('/:id/confirm-payment', authenticate, confirmPayment);

/**
 * @route   GET /api/bookings/my-bookings
 * @desc    Get user's bookings with filtering and pagination
 * @access  Private (requires authentication)
 */
router.get('/my-bookings', authenticate, getUserBookings);

/**
 * @route   GET /api/bookings/:id
 * @desc    Get booking by ID with vehicle details
 * @access  Private (requires authentication)
 */
router.get('/:id', authenticate, getBookingById);

/**
 * @route   PUT /api/bookings/:id/cancel
 * @desc    Cancel a booking
 * @access  Private (requires authentication)
 */
router.put('/:id/cancel', authenticate, cancelBooking);

export default router;
