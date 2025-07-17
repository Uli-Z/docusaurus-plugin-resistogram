const { readFileSync } = require('fs');
const { join } = require('path');
const { parse } = require('csv-parse/sync');

// Helper to parse CSV files with consistent options
const parseCsv = (content) =>
  parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    cast: (value, context) => {
      if (context.header) return value;
      if (context.column === 'resistance_pct') return parseFloat(value);
      if (context.column === 'n_isolates') return parseInt(value, 10);
      return value;
    },
  });

// Generic function to load and parse a CSV file
const loadCsvSync = (dir, file) => {
  const content = readFileSync(join(dir, file), 'utf8');
  return parseCsv(content);
};

/**
 * Builds a hierarchical tree from a flat list of data sources.
 * @param sources The flat list of DataSource objects.
 * @returns The root node of the data source tree.
 */
const buildSourceTree = (sources) => {
  const nodes = new Map();
  let root = null;

  // First pass: create nodes and identify the root
  for (const source of sources) {
    const node = { ...source, children: [] };
    nodes.set(node.id, node);
    if (!node.parent_id) {
      // A source without a parent is a root. We assume one root for simplicity.
      root = node;
    }
  }

  // Second pass: build the hierarchy
  for (const node of nodes.values()) {
    if (node.parent_id) {
      const parent = nodes.get(node.parent_id);
      if (parent) {
        parent.children.push(node);
      }
    }
  }

  if (!root) {
    throw new Error('Could not determine the root of the data source tree. Ensure one source has no parent_id.');
  }

  return root;
};

/**
 * Synchronously loads all data from the specified data directory.
 * This is used by the preset to load data before the remark transformer runs.
 * @param dataDir The directory where the CSV files are located.
 * @param options The plugin options.
 * @returns The fully loaded and structured data.
 */
const loadAllDataSync = (dataDir, options = {}) => {
  const fileNames = {
    antibiotics: options.files?.antibiotics ?? 'antibiotics.csv',
    organisms: options.files?.organisms ?? 'organisms.csv',
    data_sources: options.files?.data_sources ?? 'data_sources.csv',
  };

  // Load metadata and the source manifest
  const antibiotics = loadCsvSync(dataDir, fileNames.antibiotics);
  const organisms = loadCsvSync(dataDir, fileNames.organisms);
  const sources = loadCsvSync(dataDir, fileNames.data_sources);

  // Load all resistance files referenced in the manifest
  const resistanceData = new Map();
  for (const source of sources) {
    const data = loadCsvSync(dataDir, source.source_file);
    resistanceData.set(source.id, data);
  }

  // Build the hierarchical tree of data sources
  const sourceTree = buildSourceTree(sources);

  // Create fast-lookup maps for metadata
  const antibioticsMap = new Map(antibiotics.map((abx) => [abx.amr_code, abx]));
  const organismsMap = new Map(organisms.map((org) => [org.amr_code, org]));

  return {
    antibiotics: antibioticsMap,
    organisms: organismsMap,
    sourceTree,
    resistance: resistanceData,
  };
};

// We keep the async version for the main plugin's loadContent lifecycle
const loadAllData = async (dataDir, options) => {
  // For simplicity, we just wrap the sync version in a promise.
  // In a real-world scenario, you might keep the async implementation.
  return Promise.resolve(loadAllDataSync(dataDir, options));
};

module.exports = { loadAllData, loadAllDataSync };
