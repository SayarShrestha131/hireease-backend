import receiptService from '../services/receiptService';
import { IPaymentTransaction } from '../models/PaymentTransaction';
import { IBooking } from '../models/Booking';
import { IUser } from '../models/User';
import { IVehicle } from '../models/Vehicle';
import * as fs from 'fs';
import * as path from 'path';

describe('ReceiptService', () => {
  describe('generateReceiptNumber', () => {
    it('should generate receipt number in correct format RCP-YYYYMMDD-XXXX', () => {
      const receiptNumber = receiptService.generateReceiptNumber();
      
      // Check format: RCP-YYYYMMDD-XXXX
      const regex = /^RCP-\d{8}-\d{4}$/;
      expect(receiptNumber).toMatch(regex);
      
      // Extract date part
      const datePart = receiptNumber.substring(4, 12);
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      expect(datePart).toBe(today);
    });

    it('should generate unique receipt numbers', () => {
      const receiptNumber1 = receiptService.generateReceiptNumber();
      const receiptNumber2 = receiptService.generateReceiptNumber();
      
      expect(receiptNumber1).not.toBe(receiptNumber2);
    });
  });

  describe('generateReceipt', () => {
    it('should generate PDF receipt with valid data', async () => {
      // Mock transaction
      const mockTransaction = {
        transactionId: 'TXN-20240101-1234',
        amount: 5000,
        currency: 'NPR',
        paymentMethod: 'khalti',
        gatewayTransactionId: 'KHALTI-12345',
        completedAt: new Date(),
      } as IPaymentTransaction;

      // Mock booking with populated user and vehicle
      const mockBooking = {
        bookingId: 'BK-20240101-5678',
        pickupDate: new Date('2024-01-15'),
        dropoffDate: new Date('2024-01-20'),
        userId: {
          username: 'John Doe',
          email: 'john@example.com',
        } as IUser,
        vehicleId: {
          brand: 'Toyota',
          name: 'Corolla',
        } as IVehicle,
        priceBreakdown: {
          basePrice: 4000,
          duration: 5,
          durationDiscount: 200,
          addOnsTotal: 500,
          tax: 400,
          serviceFee: 300,
          totalPrice: 5000,
        },
        addOns: {
          helmet: true,
          gps: false,
          insurance: true,
        },
      } as any;

      // Generate receipt
      const receiptPath = await receiptService.generateReceipt(mockTransaction, mockBooking);

      // Verify file was created
      expect(fs.existsSync(receiptPath)).toBe(true);

      // Verify file is a PDF
      expect(path.extname(receiptPath)).toBe('.pdf');

      // Verify file name format
      const fileName = path.basename(receiptPath, '.pdf');
      const regex = /^RCP-\d{8}-\d{4}$/;
      expect(fileName).toMatch(regex);

      // Clean up - delete test receipt
      if (fs.existsSync(receiptPath)) {
        fs.unlinkSync(receiptPath);
      }
    });

    it('should handle missing optional fields gracefully', async () => {
      // Mock transaction with minimal data
      const mockTransaction = {
        transactionId: 'TXN-20240101-1234',
        amount: 3000,
        currency: 'USD',
        paymentMethod: 'stripe',
        gatewayTransactionId: undefined,
        completedAt: new Date(),
      } as IPaymentTransaction;

      // Mock booking with minimal data
      const mockBooking = {
        bookingId: 'BK-20240101-5678',
        pickupDate: new Date('2024-01-15'),
        dropoffDate: new Date('2024-01-20'),
        userId: {
          username: undefined,
          email: 'jane@example.com',
        } as IUser,
        vehicleId: {
          brand: 'Honda',
          name: 'Civic',
        } as IVehicle,
        priceBreakdown: {
          basePrice: 3000,
          duration: 3,
          durationDiscount: 0,
          addOnsTotal: 0,
          tax: 0,
          serviceFee: 0,
          totalPrice: 3000,
        },
        addOns: {
          helmet: false,
          gps: false,
          insurance: false,
        },
      } as any;

      // Generate receipt
      const receiptPath = await receiptService.generateReceipt(mockTransaction, mockBooking);

      // Verify file was created
      expect(fs.existsSync(receiptPath)).toBe(true);

      // Clean up
      if (fs.existsSync(receiptPath)) {
        fs.unlinkSync(receiptPath);
      }
    });
  });

  describe('getReceipt', () => {
    it('should return receipt path if file exists', async () => {
      // Create a dummy receipt file
      const receiptStoragePath = process.env.RECEIPT_STORAGE_PATH || './receipts';
      const testReceiptPath = path.join(receiptStoragePath, 'RCP-20240101-9999.pdf');
      
      // Create empty file
      fs.writeFileSync(testReceiptPath, 'test');

      // Get receipt
      const receiptPath = await receiptService.getReceipt(testReceiptPath);

      expect(receiptPath).toBe(testReceiptPath);

      // Clean up
      if (fs.existsSync(testReceiptPath)) {
        fs.unlinkSync(testReceiptPath);
      }
    });

    it('should throw error if receipt file does not exist', async () => {
      const nonExistentPath = './receipts/RCP-20240101-0000.pdf';

      await expect(receiptService.getReceipt(nonExistentPath)).rejects.toThrow('Receipt file not found');
    });
  });
});
