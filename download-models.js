/**
 * Download face-api.js models
 * Run: node download-models.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const MODELS_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';
const MODELS_DIR = path.join(__dirname, 'models');

const models = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_expression_model-weights_manifest.json',
  'face_expression_model-shard1',
];

// Create models directory if it doesn't exist
if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
}

console.log('📥 Downloading face-api.js models...\n');

let downloaded = 0;

models.forEach((model) => {
  const url = MODELS_URL + model;
  const dest = path.join(MODELS_DIR, model);

  https.get(url, (response) => {
    const file = fs.createWriteStream(dest);
    response.pipe(file);

    file.on('finish', () => {
      file.close();
      downloaded++;
      console.log(`✅ Downloaded: ${model}`);

      if (downloaded === models.length) {
        console.log('\n🎉 All models downloaded successfully!');
        console.log('📁 Models saved to:', MODELS_DIR);
      }
    });
  }).on('error', (err) => {
    fs.unlink(dest, () => {});
    console.error(`❌ Error downloading ${model}:`, err.message);
  });
});
