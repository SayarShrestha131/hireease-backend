/**
 * Migration Script: Clean KYC Subdocument IDs
 * 
 * This script removes auto-generated _id fields from nested subdocuments
 * in existing KYC submissions to fix serialization issues.
 * 
 * Run with: npx ts-node scripts/migrateKYCData.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vehicle-rental';

async function migrateKYCData() {
  try {
    console.log('🔄 Starting KYC data migration...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get the KYC collection directly
    const db = mongoose.connection.db;
    const kycCollection = db?.collection('kycsubmissions');
    
    if (!kycCollection) {
      throw new Error('KYC collection not found');
    }
    
    // Find all KYC documents
    const documents = await kycCollection.find({}).toArray();
    console.log(`📊 Found ${documents.length} KYC documents`);
    
    let updatedCount = 0;
    
    for (const doc of documents) {
      const updates: any = {};
      let needsUpdate = false;
      
      // Clean ocrData subdocuments
      if (doc.ocrData) {
        const cleanedOcrData: any = {
          extractedAt: doc.ocrData.extractedAt,
          overallConfidence: doc.ocrData.overallConfidence,
        };
        
        // Clean frontImage
        if (doc.ocrData.frontImage) {
          const { _id, id, ...frontImageData } = doc.ocrData.frontImage;
          cleanedOcrData.frontImage = frontImageData;
          if (_id || id) needsUpdate = true;
        }
        
        // Clean backImage
        if (doc.ocrData.backImage) {
          const { _id, id, ...backImageData } = doc.ocrData.backImage;
          cleanedOcrData.backImage = backImageData;
          if (_id || id) needsUpdate = true;
        }
        
        // Clean qualityCheck
        if (doc.ocrData.qualityCheck) {
          const { _id, id, ...qualityCheckData } = doc.ocrData.qualityCheck;
          cleanedOcrData.qualityCheck = qualityCheckData;
          if (_id || id) needsUpdate = true;
        }
        
        if (doc.ocrData._id || doc.ocrData.id) {
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          updates.ocrData = cleanedOcrData;
        }
      }
      
      // Clean dataVerification
      if (doc.dataVerification) {
        const { _id, id, ...dataVerificationData } = doc.dataVerification;
        if (_id || id) {
          updates.dataVerification = dataVerificationData;
          needsUpdate = true;
        }
      }
      
      // Clean faceDetection
      if (doc.faceDetection) {
        const { _id, id, ...faceDetectionData } = doc.faceDetection;
        if (_id || id) {
          updates.faceDetection = faceDetectionData;
          needsUpdate = true;
        }
      }
      
      // Clean statusHistory array
      if (doc.statusHistory && Array.isArray(doc.statusHistory)) {
        const cleanedHistory = doc.statusHistory.map((item: any) => {
          const { _id, id, ...historyData } = item;
          if (_id || id) needsUpdate = true;
          return historyData;
        });
        
        if (needsUpdate) {
          updates.statusHistory = cleanedHistory;
        }
      }
      
      // Update document if needed
      if (needsUpdate) {
        await kycCollection.updateOne(
          { _id: doc._id },
          { $set: updates }
        );
        updatedCount++;
        console.log(`✅ Updated document: ${doc._id}`);
      }
    }
    
    console.log(`\n🎉 Migration complete!`);
    console.log(`📊 Total documents: ${documents.length}`);
    console.log(`✅ Updated documents: ${updatedCount}`);
    console.log(`⏭️  Skipped documents: ${documents.length - updatedCount}`);
    
    // Close connection
    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateKYCData();
