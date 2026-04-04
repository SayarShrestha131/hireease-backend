/**
 * Download face-api.js models (binary format)
 * Run: node download-models-binary.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Use the original face-api.js models (binary format)
const MODELS_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
const MODELS_DIR = path.join(__dirname, 'models');

const models = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_landmark_68_tiny_model-weights_manifest.json',
  'face_landmark_68_tiny_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
];

// Create models directory if it doesn't exist
if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
}

console.log('📥 Downloading face-api.js models (binary format)...\n');

let downloaded = 0;
let failed = 0;

models.forEach((model) => {
  const url = MODELS_URL + model;
  const dest = path.join(MODELS_DIR, model);

  https.get(url, (response) => {
    if (response.statusCode === 404) {
      console.log(`⚠️  Skipped: ${model} (not found)`);
      failed++;
      if (downloaded + failed === models.length) {
        console.log('\n✅ Download complete!');
        console.log('📁 Models saved to:', MODELS_DIR);
      }
      return;
    }

    const file = fs.createWriteStream(dest);
    response.pipe(file);

    file.on('finish', () => {
      file.close();
      downloaded++;
      console.log(`✅ Downloaded: ${model}`);

      if (downloaded + failed === models.length) {
        console.log('\n🎉 All models downloaded successfully!');
        console.log('📁 Models saved to:', MODELS_DIR);
      }
    });
  }).on('error', (err) => {
    fs.unlink(dest, () => {});
    console.error(`❌ Error downloading ${model}:`, err.message);
    failed++;
  });
});
