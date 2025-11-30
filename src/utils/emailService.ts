import nodemailer from 'nodemailer';
import { AppError } from './errors';

/**
 * Email options interface for sending emails
 */
export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Send email using SMTP configuration from environment variables
 * @param options - Email options including recipient, subject, and content
 * @throws AppError if email fails to send
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    // Create SMTP transport using environment variables
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: parseInt(process.env.SMTP_PORT, 10) === 465, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Define email options
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    // Send email
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Email sending failed:', error);
    throw new AppError('Failed to send email', 500);
  }
};
