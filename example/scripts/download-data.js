
const https = require('https');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const GITHUB_REPO_URL =
  'https://raw.githubusercontent.com/Uli-Z/dataset-antibiotic-resistance/main';
const DESTINATION_DIR = path.join(__dirname, '..', 'data');

// Static files that are always required
const STATIC_FILES = [
  'antibiotics.csv',
  'organisms.csv',
  'data_sources.csv',
  'antibiotic_classes.csv',
  'organism_classes.csv',
];

async function downloadFile(url, dest) {
  console.log(`Downloading ${path.basename(dest)}...`);
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(
            new Error(
              `Failed to get '${url}' (status: ${response.statusCode})`,
            ),
          );
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve(dest));
        });
      })
      .on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
  });
}

async function main() {
  if (!fs.existsSync(DESTINATION_DIR)) {
    fs.mkdirSync(DESTINATION_DIR, { recursive: true });
  }

  // Check if essential files already exist.
  const essentialFilesExist = STATIC_FILES.every(file => 
    fs.existsSync(path.join(DESTINATION_DIR, file))
  );

  if (essentialFilesExist) {
    console.log('Data files already exist. Skipping download. To force a refresh, delete the "data" directory.');
    return;
  }

  console.log('Fetching data source manifest...');
  const manifestUrl = `${GITHUB_REPO_URL}/data_sources.csv`;
  const manifestPath = path.join(DESTINATION_DIR, 'data_sources.csv');
  
  let filesToDownload = [...STATIC_FILES];

  try {
    // First, download the manifest file to know which resistance files we need
    await downloadFile(manifestUrl, manifestPath);
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    
    const records = parse(manifestContent, {
      columns: true,
      skip_empty_lines: true,
    });

    const resistanceFiles = records.map((record) => record.source_file);
    // Add resistance files to the download list, ensuring no duplicates
    filesToDownload = [...new Set([...STATIC_FILES, ...resistanceFiles])];

  } catch (error) {
    console.error('Error fetching or parsing data_sources.csv, falling back to static list.', error);
    // Fallback to a known list if manifest fails
    filesToDownload = [
      ...STATIC_FILES,
      'eucast_expected_resistance.csv',
      'resistance_ars_2023_extracted.csv',
      'resistance-rki-ars-nw-2023.csv',
      'resistance_ars_2022_extracted.csv',
    ];
  }

  console.log(`\nStarting download of ${filesToDownload.length} files...`);

  for (const filename of filesToDownload) {
    // The manifest is already downloaded, so skip it in the main loop
    if (filename === 'data_sources.csv' && fs.existsSync(manifestPath)) {
        console.log('Skipping already downloaded data_sources.csv.');
        continue;
    }
    const url = `${GITHUB_REPO_URL}/${filename}`;
    const destinationPath = path.join(DESTINATION_DIR, filename);
    try {
      await downloadFile(url, destinationPath);
      console.log(` -> Saved to ${destinationPath}`);
    } catch (error) {
      console.error(`Error downloading ${filename}:`, error.message);
    }
  }

  console.log('\nAll files downloaded successfully.');
}

main();
