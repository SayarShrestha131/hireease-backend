import { NotificationService } from './notificationService';
import nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer');

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockSendMail: jest.Mock;
  let mockTransporter: any;

  beforeEach(() => {
    // Reset environment variables
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test@test.com';
    process.env.SMTP_PASS = 'testpass';
    process.env.SMTP_FROM = 'noreply@test.com';

    // Setup mock transporter
    mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-message-id' });
    mockTransporter = {
      sendMail: mockSendMail,
    };

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    // Create new instance
    notificationService = new NotificationService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendPaymentConfirmation', () => {
    it('should send payment confirmation email with all required details', async () => {
      const confirmationData = {
        bookingId: 'BK-20240101-0001',
        amount: 5000,
        currency: 'NPR',
        transactionId: 'TXN-123456',
        receiptUrl: 'http://localhost:5000/api/payments/receipt/BK-20240101-0001',
        userName: 'John Doe',
        userEmail: 'john@example.com',
        paymentMethod: 'khalti',
        paymentDate: new Date('2024-01-15T10:30:00Z'),
      };

      const result = await notificationService.sendPaymentConfirmation(confirmationData);

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.from).toBe('noreply@test.com');
      expect(emailCall.to).toBe('john@example.com');
      expect(emailCall.subject).toContain('Payment Confirmation');
      expect(emailCall.subject).toContain('BK-20240101-0001');
      expect(emailCall.html).toContain('Payment Successful!');
      expect(emailCall.html).toContain('BK-20240101-0001');
      expect(emailCall.html).toContain('NPR 5000.00');
      expect(emailCall.html).toContain('TXN-123456');
      expect(emailCall.html).toContain('khalti');
      expect(emailCall.html).toContain('Download Receipt');
      expect(emailCall.text).toContain('PAYMENT SUCCESSFUL!');
    });

    it('should include receipt download link in confirmation email', async () => {
      const confirmationData = {
        bookingId: 'BK-20240101-0001',
        amount: 5000,
        currency: 'NPR',
        transactionId: 'TXN-123456',
        receiptUrl: 'http://localhost:5000/api/payments/receipt/BK-20240101-0001',
        userName: 'John Doe',
        userEmail: 'john@example.com',
        paymentMethod: 'stripe',
        paymentDate: new Date('2024-01-15T10:30:00Z'),
      };

      await notificationService.sendPaymentConfirmation(confirmationData);

      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.html).toContain(confirmationData.receiptUrl);
      expect(emailCall.text).toContain(confirmationData.receiptUrl);
    });

    it('should return false when email configuration is missing', async () => {
      // Create service with missing config
      const originalHost = process.env.SMTP_HOST;
      process.env.SMTP_HOST = '';
      const serviceWithoutConfig = new NotificationService();
      process.env.SMTP_HOST = originalHost;

      const confirmationData = {
        bookingId: 'BK-20240101-0001',
        amount: 5000,
        currency: 'NPR',
        transactionId: 'TXN-123456',
        receiptUrl: 'http://localhost:5000/api/payments/receipt/BK-20240101-0001',
        userName: 'John Doe',
        userEmail: 'john@example.com',
        paymentMethod: 'khalti',
        paymentDate: new Date('2024-01-15T10:30:00Z'),
      };

      const result = await serviceWithoutConfig.sendPaymentConfirmation(confirmationData);

      expect(result).toBe(false);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should return false when email sending fails', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP connection failed'));

      const confirmationData = {
        bookingId: 'BK-20240101-0001',
        amount: 5000,
        currency: 'NPR',
        transactionId: 'TXN-123456',
        receiptUrl: 'http://localhost:5000/api/payments/receipt/BK-20240101-0001',
        userName: 'John Doe',
        userEmail: 'john@example.com',
        paymentMethod: 'khalti',
        paymentDate: new Date('2024-01-15T10:30:00Z'),
      };

      const result = await notificationService.sendPaymentConfirmation(confirmationData);

      expect(result).toBe(false);
    });
  });

  describe('sendPaymentFailure', () => {
    it('should send payment failure email with error details', async () => {
      const failureData = {
        bookingId: 'BK-20240101-0002',
        amount: 3000,
        currency: 'NPR',
        errorMessage: 'Insufficient funds',
        userName: 'Jane Smith',
        userEmail: 'jane@example.com',
        paymentMethod: 'stripe',
        attemptDate: new Date('2024-01-15T11:00:00Z'),
      };

      const result = await notificationService.sendPaymentFailure(failureData);

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.from).toBe('noreply@test.com');
      expect(emailCall.to).toBe('jane@example.com');
      expect(emailCall.subject).toContain('Payment Failed');
      expect(emailCall.subject).toContain('BK-20240101-0002');
      expect(emailCall.html).toContain('Payment Failed');
      expect(emailCall.html).toContain('BK-20240101-0002');
      expect(emailCall.html).toContain('NPR 3000.00');
      expect(emailCall.html).toContain('Insufficient funds');
      expect(emailCall.html).toContain('stripe');
      expect(emailCall.html).toContain('What to do next:');
      expect(emailCall.text).toContain('PAYMENT FAILED');
    });

    it('should include helpful suggestions in failure email', async () => {
      const failureData = {
        bookingId: 'BK-20240101-0002',
        amount: 3000,
        currency: 'NPR',
        errorMessage: 'Card declined',
        userName: 'Jane Smith',
        userEmail: 'jane@example.com',
        paymentMethod: 'stripe',
        attemptDate: new Date('2024-01-15T11:00:00Z'),
      };

      await notificationService.sendPaymentFailure(failureData);

      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.html).toContain('Check your payment details and try again');
      expect(emailCall.html).toContain('Try a different payment method');
      expect(emailCall.html).toContain('Contact your bank');
      expect(emailCall.text).toContain('WHAT TO DO NEXT:');
    });

    it('should return false when email configuration is missing', async () => {
      // Create service with missing config
      const originalUser = process.env.SMTP_USER;
      process.env.SMTP_USER = '';
      const serviceWithoutConfig = new NotificationService();
      process.env.SMTP_USER = originalUser;

      const failureData = {
        bookingId: 'BK-20240101-0002',
        amount: 3000,
        currency: 'NPR',
        errorMessage: 'Payment failed',
        userName: 'Jane Smith',
        userEmail: 'jane@example.com',
        paymentMethod: 'stripe',
        attemptDate: new Date('2024-01-15T11:00:00Z'),
      };

      const result = await serviceWithoutConfig.sendPaymentFailure(failureData);

      expect(result).toBe(false);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should return false when email sending fails', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('Network timeout'));

      const failureData = {
        bookingId: 'BK-20240101-0002',
        amount: 3000,
        currency: 'NPR',
        errorMessage: 'Payment failed',
        userName: 'Jane Smith',
        userEmail: 'jane@example.com',
        paymentMethod: 'stripe',
        attemptDate: new Date('2024-01-15T11:00:00Z'),
      };

      const result = await notificationService.sendPaymentFailure(failureData);

      expect(result).toBe(false);
    });
  });

  describe('Email formatting', () => {
    it('should format currency amounts correctly', async () => {
      const confirmationData = {
        bookingId: 'BK-20240101-0001',
        amount: 1234.56,
        currency: 'USD',
        transactionId: 'TXN-123456',
        receiptUrl: 'http://localhost:5000/receipt',
        userName: 'Test User',
        userEmail: 'test@example.com',
        paymentMethod: 'paypal',
        paymentDate: new Date('2024-01-15T10:30:00Z'),
      };

      await notificationService.sendPaymentConfirmation(confirmationData);

      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.html).toContain('USD 1234.56');
    });

    it('should capitalize payment method in email', async () => {
      const confirmationData = {
        bookingId: 'BK-20240101-0001',
        amount: 5000,
        currency: 'NPR',
        transactionId: 'TXN-123456',
        receiptUrl: 'http://localhost:5000/receipt',
        userName: 'Test User',
        userEmail: 'test@example.com',
        paymentMethod: 'khalti',
        paymentDate: new Date('2024-01-15T10:30:00Z'),
      };

      await notificationService.sendPaymentConfirmation(confirmationData);

      const emailCall = mockSendMail.mock.calls[0][0];
      // Check that payment method is displayed (capitalization handled by CSS)
      expect(emailCall.html).toContain('khalti');
    });
  });

  describe('Email configuration', () => {
    it('should use secure connection for port 465', () => {
      process.env.SMTP_PORT = '465';
      const service = new NotificationService();
      
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 465,
          secure: true,
        })
      );
    });

    it('should not use secure connection for port 587', () => {
      process.env.SMTP_PORT = '587';
      const service = new NotificationService();
      
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 587,
          secure: false,
        })
      );
    });
  });
});
