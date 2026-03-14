/**
 * Quick Fix Script for KYC Data
 * Run with: node scripts/quickFixKYC.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vehicle-rental';

async function quickFix() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected!');
    
    const db = mongoose.connection.db;
    const collection = db.collection('kycsubmissions');
    
    console.log('🔄 Cleaning subdocument IDs...');
    
    // Update all documents to remove _id from nested objects
    const result = await collection.updateMany(
      {},
      [
        {
          $set: {
            ocrData: {
              $cond: {
                if: { $ne: ['$ocrData', null] },
                then: {
                  frontImage: {
                    $cond: {
                      if: { $ne: ['$ocrData.frontImage', null] },
                      then: {
                        licenseNumber: '$ocrData.frontImage.licenseNumber',
                        fullName: '$ocrData.frontImage.fullName',
                        fatherName: '$ocrData.frontImage.fatherName',
                        dateOfBirth: '$ocrData.frontImage.dateOfBirth',
                        expiryDate: '$ocrData.frontImage.expiryDate',
                        issueDate: '$ocrData.frontImage.issueDate',
                        issuingAuthority: '$ocrData.frontImage.issuingAuthority',
                        address: '$ocrData.frontImage.address',
                        citizenshipNumber: '$ocrData.frontImage.citizenshipNumber',
                        licenseType: '$ocrData.frontImage.licenseType',
                        rawText: '$ocrData.frontImage.rawText',
                        confidence: '$ocrData.frontImage.confidence'
                      },
                      else: null
                    }
                  },
                  backImage: {
                    $cond: {
                      if: { $ne: ['$ocrData.backImage', null] },
                      then: {
                        address: '$ocrData.backImage.address',
                        additionalInfo: '$ocrData.backImage.additionalInfo',
                        rawText: '$ocrData.backImage.rawText',
                        confidence: '$ocrData.backImage.confidence'
                      },
                      else: null
                    }
                  },
                  qualityCheck: {
                    $cond: {
                      if: { $ne: ['$ocrData.qualityCheck', null] },
                      then: {
                        isGoodQuality: '$ocrData.qualityCheck.isGoodQuality',
                        issues: '$ocrData.qualityCheck.issues',
                        recommendation: '$ocrData.qualityCheck.recommendation'
                      },
                      else: null
                    }
                  },
                  extractedAt: '$ocrData.extractedAt',
                  overallConfidence: '$ocrData.overallConfidence'
                },
                else: null
              }
            },
            dataVerification: {
              $cond: {
                if: { $ne: ['$dataVerification', null] },
                then: {
                  licenseNumberMatch: '$dataVerification.licenseNumberMatch',
                  nameMatch: '$dataVerification.nameMatch',
                  dobMatch: '$dataVerification.dobMatch',
                  expiryDateMatch: '$dataVerification.expiryDateMatch',
                  matchScore: '$dataVerification.matchScore',
                  checkedAt: '$dataVerification.checkedAt'
                },
                else: null
              }
            },
            faceDetection: {
              $cond: {
                if: { $ne: ['$faceDetection', null] },
                then: {
                  hasFace: '$faceDetection.hasFace',
                  faceCount: '$faceDetection.faceCount',
                  confidence: '$faceDetection.confidence',
                  isRealFace: '$faceDetection.isRealFace',
                  message: '$faceDetection.message',
                  verifiedAt: '$faceDetection.verifiedAt'
                },
                else: null
              }
            }
          }
        }
      ]
    );
    
    console.log(`✅ Updated ${result.modifiedCount} documents`);
    
    await mongoose.connection.close();
    console.log('👋 Done!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

quickFix();
