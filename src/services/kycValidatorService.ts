import KYCSubmission, { IKYCSubmission } from '../models/KYCSubmission';
import mongoose from 'mongoose';

/**
 * KYC Status Type
 */
export type KYCStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';

/**
 * KYC Validator Service
 * Handles KYC verification status checking for users
 */
class KYCValidatorService {
  /**
   * Get the KYC status for a user
   * @param userId - ID of the user
   * @returns KYC status
   */
  async getKYCStatus(userId: string): Promise<KYCStatus> {
    // Find the most recent KYC submission for the user
    const kycSubmission = await KYCSubmission.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    })
      .sort({ submittedAt: -1 }) // Get most recent submission
      .exec();
    
    // If no submission found, return not_submitted
    if (!kycSubmission) {
      return 'not_submitted';
    }
    
    // Return the status from the submission
    return kycSubmission.status as KYCStatus;
  }

  /**
   * Validate if a user's KYC is approved
   * @param userId - ID of the user
   * @returns true if KYC is approved, false otherwise
   */
  async validateUserKYC(userId: string): Promise<boolean> {
    const status = await this.getKYCStatus(userId);
    return status === 'approved';
  }

  /**
   * Get the user's KYC submission details
   * @param userId - ID of the user
   * @returns KYC submission or null if not found
   */
  async getKYCSubmission(userId: string): Promise<IKYCSubmission | null> {
    const kycSubmission = await KYCSubmission.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    })
      .sort({ submittedAt: -1 })
      .exec();
    
    return kycSubmission;
  }
}

export default new KYCValidatorService();
