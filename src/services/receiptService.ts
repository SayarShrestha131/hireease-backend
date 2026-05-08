import PDFDocument = require('pdfkit');
import * as fs from 'fs';
import * as path from 'path';
import { IPaymentTransaction } from '../models/PaymentTransaction';
import { IBooking } from '../models/Booking';
import { IUser } from '../models/User';
import { IVehicle } from '../models/Vehicle';

/**
 * Receipt Data Structure
 */
export interface ReceiptData {
  receiptNumber: string;
  bookingId: string;
  transactionId: string;
  
  // User Information
  userName: string;
  userEmail: string;
  
  // Booking Information
  vehicleName: string;
  pickupDate: Date;
  dropoffDate: Date;
  
  // Payment Information
  paymentDate: Date;
  paymentMethod: string;
  gatewayTransactionId: string;
  
  // Price Breakdown
  basePrice: number;
  duration: number;
  durationDiscount: number;
  addOns: {
    helmet?: number;
    gps?: number;
    insurance?: number;
  };
  addOnsTotal: number;
  tax: number;
  serviceFee: number;
  totalAmount: number;
  
  currency: string;
}

/**
 * ReceiptService - Generates and manages digital receipts
 * 
 * Generates PDF receipts with itemized breakdown, stores receipt files,
 * and provides receipt retrieval functionality.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 8.7
 */
export class ReceiptService {
  private receiptStoragePath: string;
  private receiptCounter: number = 0;

  constructor() {
    // Read RECEIPT_STORAGE_PATH from environment variables
    this.receiptStoragePath = process.env.RECEIPT_STORAGE_PATH || './receipts';
    
    // Ensure receipt storage directory exists
    this.ensureStorageDirectory();
    
    // Initialize counter from existing receipts
    this.initializeCounter();
  }

  /**
   * Ensure receipt storage directory exists
   */
  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.receiptStoragePath)) {
      fs.mkdirSync(this.receiptStoragePath, { recursive: true });
      console.log(`[ReceiptService] Created receipt storage directory: ${this.receiptStoragePath}`);
    }
  }

  /**
   * Initialize receipt counter from existing receipts
   */
  private initializeCounter(): void {
    try {
      const files = fs.readdirSync(this.receiptStoragePath);
      const receiptFiles = files.filter(f => f.startsWith('RCP-') && f.endsWith('.pdf'));
      
      if (receiptFiles.length > 0) {
        // Extract counter from last receipt
        const lastReceipt = receiptFiles.sort().pop();
        if (lastReceipt) {
          const match = lastReceipt.match(/RCP-\d{8}-(\d{4})/);
          if (match) {
            this.receiptCounter = parseInt(match[1], 10);
          }
        }
      }
    } catch (error) {
      console.error('[ReceiptService] Failed to initialize counter:', error);
      this.receiptCounter = 0;
    }
  }

  /**
   * Generate unique receipt number in format RCP-YYYYMMDD-XXXX
   * 
   * @returns Unique receipt number
   * 
   * Requirements: 6.7
   */
  generateReceiptNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    
    // Increment counter and wrap at 9999
    this.receiptCounter = (this.receiptCounter + 1) % 10000;
    const counterStr = this.receiptCounter.toString().padStart(4, '0');
    
    return `RCP-${dateStr}-${counterStr}`;
  }

  /**
   * Generate digital receipt PDF
   * 
   * @param transaction - Payment transaction
   * @param booking - Booking with populated user and vehicle
   * @returns File path to generated PDF
   * 
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7
   */
  async generateReceipt(
    transaction: IPaymentTransaction,
    booking: IBooking & { userId: IUser; vehicleId: IVehicle }
  ): Promise<string> {
    try {
      // Generate unique receipt number
      const receiptNumber = this.generateReceiptNumber();
      
      // Prepare receipt data
      const receiptData: ReceiptData = {
        receiptNumber,
        bookingId: booking.bookingId,
        transactionId: transaction.transactionId,
        
        // User Information
        userName: booking.userId.username || booking.userId.email,
        userEmail: booking.userId.email,
        
        // Booking Information
        vehicleName: `${booking.vehicleId.brand} ${booking.vehicleId.name}`,
        pickupDate: booking.pickupDate,
        dropoffDate: booking.dropoffDate,
        
        // Payment Information
        paymentDate: transaction.completedAt || new Date(),
        paymentMethod: this.formatPaymentMethod(transaction.paymentMethod),
        gatewayTransactionId: transaction.gatewayTransactionId || 'N/A',
        
        // Price Breakdown
        basePrice: booking.priceBreakdown.basePrice,
        duration: booking.priceBreakdown.duration,
        durationDiscount: booking.priceBreakdown.durationDiscount,
        addOns: this.calculateAddOnsPrices(booking),
        addOnsTotal: booking.priceBreakdown.addOnsTotal,
        tax: booking.priceBreakdown.tax,
        serviceFee: booking.priceBreakdown.serviceFee,
        totalAmount: transaction.amount,
        
        currency: transaction.currency,
      };
      
      // Generate PDF
      const filePath = await this.createPDF(receiptData);
      
      console.log(`[ReceiptService] Receipt generated: ${receiptNumber} at ${filePath}`);
      
      return filePath;
    } catch (error: any) {
      console.error('[ReceiptService] Failed to generate receipt:', error);
      throw new Error(`Failed to generate receipt: ${error.message}`);
    }
  }

  /**
   * Create PDF document with receipt data
   * 
   * @param data - Receipt data
   * @returns File path to generated PDF
   */
  private async createPDF(data: ReceiptData): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Create PDF document
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        
        // Generate file path
        const fileName = `${data.receiptNumber}.pdf`;
        const filePath = path.join(this.receiptStoragePath, fileName);
        
        // Pipe to file
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);
        
        // Add content to PDF
        this.addHeader(doc, data);
        this.addUserInfo(doc, data);
        this.addBookingInfo(doc, data);
        this.addPaymentInfo(doc, data);
        this.addPriceBreakdown(doc, data);
        this.addFooter(doc);
        
        // Finalize PDF
        doc.end();
        
        // Wait for file to be written
        writeStream.on('finish', () => {
          resolve(filePath);
        });
        
        writeStream.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add header to PDF
   */
  private addHeader(doc: PDFKit.PDFDocument, data: ReceiptData): void {
    // Check if in sandbox mode (Requirements: 19.4)
    const isSandboxMode = process.env.PAYMENT_MODE === 'sandbox';
    
    if (isSandboxMode) {
      // Add sandbox mode banner
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#856404')
        .text('⚠️ SANDBOX MODE - TEST RECEIPT', { align: 'center' })
        .fillColor('#000000')
        .moveDown(0.5);
    }
    
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('PAYMENT RECEIPT', { align: 'center' })
      .moveDown(0.5);
    
    doc
      .fontSize(12)
      .font('Helvetica')
      .text('Hire Ease - Vehicle Rental Service', { align: 'center' })
      .moveDown(1);
    
    // Receipt number and date
    doc
      .fontSize(10)
      .text(`Receipt Number: ${data.receiptNumber}`, { align: 'right' })
      .text(`Date: ${this.formatDate(data.paymentDate)}`, { align: 'right' })
      .moveDown(1);
    
    // Divider line
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .stroke()
      .moveDown(1);
  }

  /**
   * Add user information to PDF
   */
  private addUserInfo(doc: PDFKit.PDFDocument, data: ReceiptData): void {
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Customer Information')
      .moveDown(0.5);
    
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Name: ${data.userName}`)
      .text(`Email: ${data.userEmail}`)
      .moveDown(1);
  }

  /**
   * Add booking information to PDF
   */
  private addBookingInfo(doc: PDFKit.PDFDocument, data: ReceiptData): void {
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Booking Information')
      .moveDown(0.5);
    
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Booking ID: ${data.bookingId}`)
      .text(`Vehicle: ${data.vehicleName}`)
      .text(`Pickup Date: ${this.formatDate(data.pickupDate)}`)
      .text(`Dropoff Date: ${this.formatDate(data.dropoffDate)}`)
      .text(`Duration: ${data.duration} day${data.duration > 1 ? 's' : ''}`)
      .moveDown(1);
  }

  /**
   * Add payment information to PDF
   */
  private addPaymentInfo(doc: PDFKit.PDFDocument, data: ReceiptData): void {
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Payment Information')
      .moveDown(0.5);
    
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Transaction ID: ${data.transactionId}`)
      .text(`Payment Method: ${data.paymentMethod}`)
      .text(`Gateway Transaction ID: ${data.gatewayTransactionId}`)
      .text(`Payment Date: ${this.formatDate(data.paymentDate)}`)
      .moveDown(1);
  }

  /**
   * Add itemized price breakdown to PDF
   */
  private addPriceBreakdown(doc: PDFKit.PDFDocument, data: ReceiptData): void {
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Price Breakdown')
      .moveDown(0.5);
    
    const leftMargin = 50;
    const rightMargin = 550;
    
    doc.fontSize(10).font('Helvetica');
    
    // Base price
    this.addLineItem(doc, 'Base Price', this.formatCurrency(data.basePrice, data.currency), leftMargin, rightMargin);
    
    // Duration discount
    if (data.durationDiscount > 0) {
      this.addLineItem(doc, 'Duration Discount', `-${this.formatCurrency(data.durationDiscount, data.currency)}`, leftMargin, rightMargin);
    }
    
    // Add-ons
    if (data.addOns.helmet && data.addOns.helmet > 0) {
      this.addLineItem(doc, 'Helmet', this.formatCurrency(data.addOns.helmet, data.currency), leftMargin, rightMargin);
    }
    if (data.addOns.gps && data.addOns.gps > 0) {
      this.addLineItem(doc, 'GPS', this.formatCurrency(data.addOns.gps, data.currency), leftMargin, rightMargin);
    }
    if (data.addOns.insurance && data.addOns.insurance > 0) {
      this.addLineItem(doc, 'Insurance', this.formatCurrency(data.addOns.insurance, data.currency), leftMargin, rightMargin);
    }
    
    // Tax
    if (data.tax > 0) {
      this.addLineItem(doc, 'Tax', this.formatCurrency(data.tax, data.currency), leftMargin, rightMargin);
    }
    
    // Service fee
    if (data.serviceFee > 0) {
      this.addLineItem(doc, 'Service Fee', this.formatCurrency(data.serviceFee, data.currency), leftMargin, rightMargin);
    }
    
    // Divider line
    doc.moveDown(0.5);
    doc
      .moveTo(leftMargin, doc.y)
      .lineTo(rightMargin, doc.y)
      .stroke()
      .moveDown(0.5);
    
    // Total
    doc.fontSize(12).font('Helvetica-Bold');
    this.addLineItem(doc, 'Total Amount', this.formatCurrency(data.totalAmount, data.currency), leftMargin, rightMargin);
    
    doc.moveDown(1);
  }

  /**
   * Add a line item to the PDF
   */
  private addLineItem(
    doc: PDFKit.PDFDocument,
    label: string,
    value: string,
    leftMargin: number,
    rightMargin: number
  ): void {
    const y = doc.y;
    doc.text(label, leftMargin, y);
    doc.text(value, leftMargin, y, { align: 'right', width: rightMargin - leftMargin });
    doc.moveDown(0.3);
  }

  /**
   * Add footer to PDF
   */
  private addFooter(doc: PDFKit.PDFDocument): void {
    doc
      .moveDown(2)
      .fontSize(9)
      .font('Helvetica')
      .text('Thank you for choosing Hire Ease!', { align: 'center' })
      .moveDown(0.5)
      .text('For support, contact us at support@hireease.com', { align: 'center' })
      .moveDown(0.5)
      .font('Helvetica-Oblique')
      .text('This is a computer-generated receipt and does not require a signature.', { align: 'center' });
  }

  /**
   * Format payment method for display
   */
  private formatPaymentMethod(method: string): string {
    const methodMap: Record<string, string> = {
      khalti: 'Khalti',
      stripe: 'Stripe (Card)',
      paypal: 'PayPal',
    };
    return methodMap[method] || method;
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Format currency for display
   */
  private formatCurrency(amount: number, currency: string): string {
    const currencySymbols: Record<string, string> = {
      NPR: 'Rs.',
      USD: '$',
    };
    const symbol = currencySymbols[currency] || currency;
    return `${symbol} ${amount.toFixed(2)}`;
  }

  /**
   * Calculate individual add-on prices
   */
  private calculateAddOnsPrices(booking: IBooking): {
    helmet?: number;
    gps?: number;
    insurance?: number;
  } {
    // Standard add-on prices (could be moved to config)
    const ADD_ON_PRICES = {
      helmet: 50,
      gps: 100,
      insurance: 200,
    };
    
    const addOns: { helmet?: number; gps?: number; insurance?: number } = {};
    
    if (booking.addOns.helmet) {
      addOns.helmet = ADD_ON_PRICES.helmet * booking.priceBreakdown.duration;
    }
    if (booking.addOns.gps) {
      addOns.gps = ADD_ON_PRICES.gps * booking.priceBreakdown.duration;
    }
    if (booking.addOns.insurance) {
      addOns.insurance = ADD_ON_PRICES.insurance * booking.priceBreakdown.duration;
    }
    
    return addOns;
  }

  /**
   * Get receipt file path for a booking
   * 
   * @param receiptPath - Receipt file path from transaction
   * @returns Receipt file path or URL
   * 
   * Requirements: 6.6, 8.7
   */
  async getReceipt(receiptPath: string): Promise<string> {
    try {
      // Check if file exists
      if (!fs.existsSync(receiptPath)) {
        throw new Error('Receipt file not found');
      }
      
      return receiptPath;
    } catch (error: any) {
      console.error('[ReceiptService] Failed to get receipt:', error);
      throw new Error(`Failed to retrieve receipt: ${error.message}`);
    }
  }
}

export default new ReceiptService();
