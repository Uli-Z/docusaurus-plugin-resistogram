const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { finished } = require('stream/promises');
const { parse } = require('csv-parse/sync');

const DATA_DIR = path.join(__dirname, '..', 'example', 'data');
const BASE_URL = 'https://raw.githubusercontent.com/Uli-Z/dataset-antibiotic-resistance/main/';

const STATIC_FILES = [
  'antibiotics.csv',
  'organisms.csv',
  'antibiotic_classes.csv',
  'organism_classes.csv',
  'organism_groups.csv',
];

async function downloadFile(url, dest) {
  console.log(`Downloading ${url} to ${dest}`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to download ${url}: ${res.statusText}`);
    }
    const body = Readable.fromWeb(res.body);
    await finished(body.pipe(fs.createWriteStream(dest)));
  } catch (e) {
    console.error(e);
    // If a file fails, clean up and exit
    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
    }
    throw e;
  }
}

async function getResistanceFiles() {
  const url = `${BASE_URL}data_sources.csv`;
  const dest = path.join(DATA_DIR, 'data_sources.csv');
  await downloadFile(url, dest);

  const content = fs.readFileSync(dest, 'utf8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
  });

  const files = records.map((record) => record.source_file);
  return ['data_sources.csv', ...files];
}

async function main() {
  // Check if data directory is empty or doesn't exist
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const existingFiles = fs.readdirSync(DATA_DIR);
  if (existingFiles.length > 0) {
    console.log('Data directory is not empty. Skipping download.');
    return;
  }

  console.log('Data directory is empty. Starting download of example data...');

  try {
    const resistanceFiles = await getResistanceFiles();
    const allFiles = [...STATIC_FILES, ...resistanceFiles];
    const uniqueFiles = [...new Set(allFiles)];

    for (const file of uniqueFiles) {
      if (file) {
        const url = `${BASE_URL}${file}`;
        const dest = path.join(DATA_DIR, file);
        // Skip download if file already exists from getResistanceFiles()
        if (!fs.existsSync(dest)) {
          await downloadFile(url, dest);
        }
      }
    }
    console.log('All data files downloaded successfully.');
  } catch (error) {
    console.error('Failed to download one or more files. The data directory might be incomplete.');
    process.exit(1);
  }
}

main();
