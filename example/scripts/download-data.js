
const https = require('https');
const fs = require('fs');
const path = require('path');

const GITHUB_REPO_URL = 'https://raw.githubusercontent.com/Uli-Z/dataset-antibiotic-resistance/main';
const DESTINATION_DIR = path.join(__dirname, '..', 'data');

const FILES_TO_DOWNLOAD = [
  'antibiotics.csv',
  'organisms.csv',
  'resistance-rki-ars-nw-2023.csv',
  'data_sources.csv',
  'antibiotic_classes.csv',
  'organism_classes.csv',
  'eucast_expected_resistance.csv',
  'resistance-rki-ars-nw-2022.csv'
];

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function main() {
  if (!fs.existsSync(DESTINATION_DIR)) {
    fs.mkdirSync(DESTINATION_DIR, { recursive: true });
  }

  console.log(`Starting download of ${FILES_TO_DOWNLOAD.length} files...`);

  for (const filename of FILES_TO_DOWNLOAD) {
    const url = `${GITHUB_REPO_URL}/${filename}`;
    const destinationPath = path.join(DESTINATION_DIR, filename);
    try {
      console.log(`Downloading ${filename}...`);
      await downloadFile(url, destinationPath);
      console.log(` -> Saved to ${destinationPath}`);
    } catch (error) {
      console.error(`Error downloading ${filename}:`, error);
    }
  }

  console.log('All files downloaded successfully.');
}

main();
