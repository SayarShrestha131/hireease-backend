import mongoose from 'mongoose';
import PaymentTransaction from '../models/PaymentTransaction';
import Booking from '../models/Booking';
import User from '../models/User';
import Vehicle from '../models/Vehicle';
import { PaymentService } from './paymentService';
import khaltiService from './khaltiService';
import notificationService from './notificationService';

// Mock services
jest.mock('./khaltiService');
jest.mock('./notificationService');
jest.mock('./receiptService', () => ({
  __esModule: true,
  default: {
    generateReceipt: jest.fn().mockResolvedValue('./receipts/RCP-20240115-0001.pdf'),
  },
}));
jest.mock('./auditLogService', () => ({
  __esModule: true,
  default: {
    logPaymentSuccess: jest.fn(),
    logPaymentFailure: jest.fn(),
  },
}));

describe('PaymentService - Notification Integration', () => {
  let paymentService: PaymentService;
  let mockUser: any;
  let mockVehicle: any;
  let mockBooking: any;
  let mockTransaction: any;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create test data
    mockUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashedpassword',
      phoneNumber: '1234567890',
      role: 'user',
    });

    mockVehicle = await Vehicle.create({
      name: 'Test Vehicle',
      brand: 'Toyota',
      vehicleModel: 'Camry',
      year: 2023,
      type: 'sedan',
      fuelType: 'petrol',
      transmission: 'automatic',
      seats: 5,
      pricePerDay: 5000,
      description: 'Test vehicle for payment testing',
      availability: {
        isAvailable: true,
        location: 'Test Location',
      },
    });

    mockBooking = await Booking.create({
      bookingId: 'BK-20240115-0001',
      userId: mockUser._id,
      vehicleId: mockVehicle._id,
      pickupDate: new Date('2024-02-01'),
      dropoffDate: new Date('2024-02-05'),
      pickupTime: '10:00',
      dropoffTime: '10:00',
      priceBreakdown: {
        basePrice: 5000,
        duration: 4,
        durationDiscount: 0,
        addOnsTotal: 0,
        tax: 0,
        serviceFee: 0,
        totalPrice: 20000,
      },
      status: 'pending',
      paymentStatus: 'pending',
    });

    mockTransaction = await PaymentTransaction.create({
      transactionId: 'TXN-TEST-001',
      bookingId: mockBooking._id,
      userId: mockUser._id,
      amount: 20000,
      currency: 'NPR',
      paymentMethod: 'khalti',
      gateway: 'khalti',
      status: 'processing',
      gatewayPaymentToken: 'test-pidx-123',
      idempotencyKey: 'test-idempotency-key-001',
    });

    paymentService = new PaymentService();
  });

  afterEach(async () => {
    // Clean up test data
    await PaymentTransaction.deleteMany({});
    await Booking.deleteMany({});
    await Vehicle.deleteMany({});
    await User.deleteMany({});
  });

  describe('verifyPayment - Success Notification', () => {
    it('should send payment confirmation email when payment succeeds', async () => {
      // Mock Khalti verification success
      (khaltiService.verifyPayment as jest.Mock).mockResolvedValue({
        pidx: 'test-pidx-123',
        status: 'Completed',
        transaction_id: 'khalti-txn-123',
        total_amount: 20000,
        fee: 0,
        refunded: false,
      });

      // Mock notification service
      (notificationService.sendPaymentConfirmation as jest.Mock).mockResolvedValue(true);

      // Verify payment
      const result = await paymentService.verifyPayment('TXN-TEST-001', {
        pidx: 'test-pidx-123',
      });

      // Verify payment succeeded
      expect(result.success).toBe(true);
      expect(result.paymentStatus).toBe('completed');

      // Verify confirmation email was sent
      expect(notificationService.sendPaymentConfirmation).toHaveBeenCalledTimes(1);
      expect(notificationService.sendPaymentConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'BK-20240115-0001',
          amount: 20000,
          currency: 'NPR',
          transactionId: 'TXN-TEST-001',
          userEmail: 'test@example.com',
          paymentMethod: 'khalti',
        })
      );

      // Verify receipt URL is included
      const callArgs = (notificationService.sendPaymentConfirmation as jest.Mock).mock.calls[0][0];
      expect(callArgs.receiptUrl).toContain('/api/payments/receipt/BK-20240115-0001');
    });

    it('should not fail payment verification if email sending fails', async () => {
      // Mock Khalti verification success
      (khaltiService.verifyPayment as jest.Mock).mockResolvedValue({
        pidx: 'test-pidx-123',
        status: 'Completed',
        transaction_id: 'khalti-txn-123',
        total_amount: 20000,
        fee: 0,
        refunded: false,
      });

      // Mock notification service failure
      (notificationService.sendPaymentConfirmation as jest.Mock).mockRejectedValue(
        new Error('SMTP connection failed')
      );

      // Verify payment
      const result = await paymentService.verifyPayment('TXN-TEST-001', {
        pidx: 'test-pidx-123',
      });

      // Verify payment still succeeded despite email failure
      expect(result.success).toBe(true);
      expect(result.paymentStatus).toBe('completed');

      // Verify booking status was updated
      const updatedBooking = await Booking.findById(mockBooking._id);
      expect(updatedBooking?.status).toBe('confirmed');
      expect(updatedBooking?.paymentStatus).toBe('completed');
    });
  });

  describe('verifyPayment - Failure Notification', () => {
    it('should send payment failure email when payment fails', async () => {
      // Mock Khalti verification failure
      (khaltiService.verifyPayment as jest.Mock).mockResolvedValue({
        pidx: 'test-pidx-123',
        status: 'Failed',
        transaction_id: 'khalti-txn-123',
        total_amount: 20000,
        fee: 0,
        refunded: false,
      });

      // Mock notification service
      (notificationService.sendPaymentFailure as jest.Mock).mockResolvedValue(true);

      // Verify payment
      const result = await paymentService.verifyPayment('TXN-TEST-001', {
        pidx: 'test-pidx-123',
      });

      // Verify payment failed
      expect(result.success).toBe(false);
      expect(result.paymentStatus).toBe('failed');

      // Verify failure email was sent
      expect(notificationService.sendPaymentFailure).toHaveBeenCalledTimes(1);
      expect(notificationService.sendPaymentFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'BK-20240115-0001',
          amount: 20000,
          currency: 'NPR',
          errorMessage: expect.stringContaining('Failed'),
          userEmail: 'test@example.com',
          paymentMethod: 'khalti',
        })
      );
    });

    it('should not fail payment verification if failure email sending fails', async () => {
      // Mock Khalti verification failure
      (khaltiService.verifyPayment as jest.Mock).mockResolvedValue({
        pidx: 'test-pidx-123',
        status: 'Failed',
        transaction_id: 'khalti-txn-123',
        total_amount: 20000,
        fee: 0,
        refunded: false,
      });

      // Mock notification service failure
      (notificationService.sendPaymentFailure as jest.Mock).mockRejectedValue(
        new Error('Email service unavailable')
      );

      // Verify payment
      const result = await paymentService.verifyPayment('TXN-TEST-001', {
        pidx: 'test-pidx-123',
      });

      // Verify payment failure was still recorded despite email failure
      expect(result.success).toBe(false);
      expect(result.paymentStatus).toBe('failed');

      // Verify booking status was updated
      const updatedBooking = await Booking.findById(mockBooking._id);
      expect(updatedBooking?.paymentStatus).toBe('failed');
    });
  });

  describe('Email timing requirement', () => {
    it('should send confirmation email within 60 seconds of payment completion', async () => {
      // Mock Khalti verification success
      (khaltiService.verifyPayment as jest.Mock).mockResolvedValue({
        pidx: 'test-pidx-123',
        status: 'Completed',
        transaction_id: 'khalti-txn-123',
        total_amount: 20000,
        fee: 0,
        refunded: false,
      });

      // Mock notification service with timing
      let emailSentTime: number;
      (notificationService.sendPaymentConfirmation as jest.Mock).mockImplementation(async () => {
        emailSentTime = Date.now();
        return true;
      });

      // Verify payment
      const startTime = Date.now();
      await paymentService.verifyPayment('TXN-TEST-001', {
        pidx: 'test-pidx-123',
      });
      const endTime = Date.now();

      // Verify email was sent
      expect(notificationService.sendPaymentConfirmation).toHaveBeenCalled();

      // Verify timing (should be within 60 seconds, but in tests it's immediate)
      const elapsedTime = endTime - startTime;
      expect(elapsedTime).toBeLessThan(60000); // 60 seconds
    });
  });
});
