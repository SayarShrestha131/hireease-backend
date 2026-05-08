import nodemailer from 'nodemailer';
import { IPaymentTransaction } from '../models/PaymentTransaction';
import { IBooking } from '../models/Booking';
import { IUser } from '../models/User';

/**
 * Email Configuration Interface
 */
interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

/**
 * Payment Confirmation Email Data
 */
interface PaymentConfirmationData {
  bookingId: string;
  amount: number;
  currency: string;
  transactionId: string;
  receiptUrl: string;
  userName: string;
  userEmail: string;
  paymentMethod: string;
  paymentDate: Date;
}

/**
 * Payment Failure Email Data
 */
interface PaymentFailureData {
  bookingId: string;
  amount: number;
  currency: string;
  errorMessage: string;
  userName: string;
  userEmail: string;
  paymentMethod: string;
  attemptDate: Date;
}

/**
 * NotificationService - Sends payment-related email notifications
 * 
 * Implements email notification requirements for payment confirmations and failures.
 * Uses nodemailer with SMTP configuration from environment variables.
 * 
 * Requirements: 16.1, 16.2, 16.3, 16.4
 */
export class NotificationService {
  private transporter: nodemailer.Transporter | null = null;
  private emailConfig: EmailConfig;
  private isConfigured: boolean = false;

  constructor() {
    this.emailConfig = this.loadEmailConfig();
    this.initializeTransporter();
  }

  /**
   * Load email configuration from environment variables
   * 
   * @returns EmailConfig
   */
  private loadEmailConfig(): EmailConfig {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM;

    if (!host || !port || !user || !pass || !from) {
      console.warn('[NotificationService] Email configuration incomplete. Email notifications will be disabled.');
      return {
        host: '',
        port: 0,
        secure: false,
        auth: { user: '', pass: '' },
        from: '',
      };
    }

    return {
      host,
      port: parseInt(port, 10),
      secure: parseInt(port, 10) === 465, // Use secure connection for port 465
      auth: {
        user,
        pass,
      },
      from,
    };
  }

  /**
   * Initialize nodemailer transporter
   */
  private initializeTransporter(): void {
    if (!this.emailConfig.host) {
      console.warn('[NotificationService] Skipping transporter initialization - email config missing');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: this.emailConfig.host,
        port: this.emailConfig.port,
        secure: this.emailConfig.secure,
        auth: {
          user: this.emailConfig.auth.user,
          pass: this.emailConfig.auth.pass,
        },
      });

      this.isConfigured = true;
      console.log('[NotificationService] Email transporter initialized successfully');
    } catch (error: any) {
      console.error('[NotificationService] Failed to initialize email transporter:', error.message);
      this.isConfigured = false;
    }
  }

  /**
   * Send payment confirmation email
   * 
   * Sends email with booking ID, amount, transaction ID, and receipt link
   * within 60 seconds of payment completion.
   * 
   * @param data - Payment confirmation data
   * @returns Promise<boolean> - Success status
   * 
   * Requirements: 16.1, 16.2, 16.3
   */
  async sendPaymentConfirmation(data: PaymentConfirmationData): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      console.warn('[NotificationService] Email not configured. Skipping payment confirmation email.');
      return false;
    }

    try {
      const startTime = Date.now();

      const subject = `Payment Confirmation - Booking ${data.bookingId}`;
      const htmlContent = this.generateConfirmationEmailHtml(data);
      const textContent = this.generateConfirmationEmailText(data);

      await this.transporter.sendMail({
        from: this.emailConfig.from,
        to: data.userEmail,
        subject,
        text: textContent,
        html: htmlContent,
      });

      const elapsedTime = Date.now() - startTime;
      console.log(`[NotificationService] Payment confirmation email sent to ${data.userEmail} for booking ${data.bookingId} (${elapsedTime}ms)`);

      return true;
    } catch (error: any) {
      console.error('[NotificationService] Failed to send payment confirmation email:', error.message);
      return false;
    }
  }

  /**
   * Send payment failure notification email
   * 
   * Sends email with error details when payment fails.
   * 
   * @param data - Payment failure data
   * @returns Promise<boolean> - Success status
   * 
   * Requirements: 16.4
   */
  async sendPaymentFailure(data: PaymentFailureData): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      console.warn('[NotificationService] Email not configured. Skipping payment failure email.');
      return false;
    }

    try {
      const subject = `Payment Failed - Booking ${data.bookingId}`;
      const htmlContent = this.generateFailureEmailHtml(data);
      const textContent = this.generateFailureEmailText(data);

      await this.transporter.sendMail({
        from: this.emailConfig.from,
        to: data.userEmail,
        subject,
        text: textContent,
        html: htmlContent,
      });

      console.log(`[NotificationService] Payment failure email sent to ${data.userEmail} for booking ${data.bookingId}`);

      return true;
    } catch (error: any) {
      console.error('[NotificationService] Failed to send payment failure email:', error.message);
      return false;
    }
  }

  /**
   * Generate HTML content for payment confirmation email
   * 
   * @param data - Payment confirmation data
   * @returns HTML string
   */
  private generateConfirmationEmailHtml(data: PaymentConfirmationData): string {
    const formattedAmount = `${data.currency} ${data.amount.toFixed(2)}`;
    const formattedDate = data.paymentDate.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Confirmation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
    <h1 style="margin: 0;">Payment Successful!</h1>
  </div>
  
  <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px;">
    <p>Dear ${data.userName},</p>
    
    <p>Your payment has been successfully processed. Thank you for your booking!</p>
    
    <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
      <h2 style="color: #4CAF50; margin-top: 0;">Payment Details</h2>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Booking ID:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${data.bookingId}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Amount Paid:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${formattedAmount}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Transaction ID:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-family: monospace; font-size: 12px;">${data.transactionId}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Payment Method:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; text-transform: capitalize;">${data.paymentMethod}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>Payment Date:</strong></td>
          <td style="padding: 8px 0; text-align: right;">${formattedDate}</td>
        </tr>
      </table>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.receiptUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Download Receipt</a>
    </div>
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      If you have any questions about your booking or payment, please contact our support team.
    </p>
    
    <p style="color: #666; font-size: 14px;">
      Thank you for choosing our service!
    </p>
  </div>
  
  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>This is an automated email. Please do not reply to this message.</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate plain text content for payment confirmation email
   * 
   * @param data - Payment confirmation data
   * @returns Plain text string
   */
  private generateConfirmationEmailText(data: PaymentConfirmationData): string {
    const formattedAmount = `${data.currency} ${data.amount.toFixed(2)}`;
    const formattedDate = data.paymentDate.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return `
PAYMENT SUCCESSFUL!

Dear ${data.userName},

Your payment has been successfully processed. Thank you for your booking!

PAYMENT DETAILS
---------------
Booking ID: ${data.bookingId}
Amount Paid: ${formattedAmount}
Transaction ID: ${data.transactionId}
Payment Method: ${data.paymentMethod}
Payment Date: ${formattedDate}

DOWNLOAD RECEIPT
${data.receiptUrl}

If you have any questions about your booking or payment, please contact our support team.

Thank you for choosing our service!

---
This is an automated email. Please do not reply to this message.
    `.trim();
  }

  /**
   * Generate HTML content for payment failure email
   * 
   * @param data - Payment failure data
   * @returns HTML string
   */
  private generateFailureEmailHtml(data: PaymentFailureData): string {
    const formattedAmount = `${data.currency} ${data.amount.toFixed(2)}`;
    const formattedDate = data.attemptDate.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Failed</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f44336; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
    <h1 style="margin: 0;">Payment Failed</h1>
  </div>
  
  <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px;">
    <p>Dear ${data.userName},</p>
    
    <p>We were unable to process your payment for booking <strong>${data.bookingId}</strong>.</p>
    
    <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
      <h2 style="color: #f44336; margin-top: 0;">Payment Details</h2>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Booking ID:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${data.bookingId}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${formattedAmount}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Payment Method:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; text-transform: capitalize;">${data.paymentMethod}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>Attempt Date:</strong></td>
          <td style="padding: 8px 0; text-align: right;">${formattedDate}</td>
        </tr>
      </table>
      
      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 20px;">
        <p style="margin: 0; color: #856404;"><strong>Error:</strong> ${data.errorMessage}</p>
      </div>
    </div>
    
    <div style="background-color: #e3f2fd; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #1976D2;">What to do next:</h3>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>Check your payment details and try again</li>
        <li>Try a different payment method</li>
        <li>Contact your bank if the issue persists</li>
        <li>Reach out to our support team for assistance</li>
      </ul>
    </div>
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      Your booking is still reserved. Please complete the payment to confirm your reservation.
    </p>
  </div>
  
  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>This is an automated email. Please do not reply to this message.</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate plain text content for payment failure email
   * 
   * @param data - Payment failure data
   * @returns Plain text string
   */
  private generateFailureEmailText(data: PaymentFailureData): string {
    const formattedAmount = `${data.currency} ${data.amount.toFixed(2)}`;
    const formattedDate = data.attemptDate.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return `
PAYMENT FAILED

Dear ${data.userName},

We were unable to process your payment for booking ${data.bookingId}.

PAYMENT DETAILS
---------------
Booking ID: ${data.bookingId}
Amount: ${formattedAmount}
Payment Method: ${data.paymentMethod}
Attempt Date: ${formattedDate}

ERROR: ${data.errorMessage}

WHAT TO DO NEXT:
- Check your payment details and try again
- Try a different payment method
- Contact your bank if the issue persists
- Reach out to our support team for assistance

Your booking is still reserved. Please complete the payment to confirm your reservation.

---
This is an automated email. Please do not reply to this message.
    `.trim();
  }
}

export default new NotificationService();
