import { readFile } from 'fs/promises';
import { join } from 'path';
import { parse } from 'csv-parse/sync';

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
const loadCsv = async (dir, file) => {
  const content = await readFile(join(dir, file), 'utf8');
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
 * Loads all data from the specified data directory.
 * This function is called once at startup by the Docusaurus plugin.
 * @param dataDir The directory where the CSV files are located.
 * @param options The plugin options.
 * @returns A promise that resolves to the fully loaded and structured data.
 */
export const loadAllData = async (
  dataDir,
  options,
) => {
  const fileNames = {
    antibiotics: options.files?.antibiotics ?? 'antibiotics.csv',
    organisms: options.files?.organisms ?? 'organisms.csv',
    data_sources: options.files?.data_sources ?? 'data_sources.csv',
  };

  // Load metadata and the source manifest
  const [antibiotics, organisms, sources] = await Promise.all([
    loadCsv(dataDir, fileNames.antibiotics),
    loadCsv(dataDir, fileNames.organisms),
    loadCsv(dataDir, fileNames.data_sources),
  ]);

  // Load all resistance files referenced in the manifest
  const resistanceData = new Map();
  await Promise.all(
    sources.map(async (source) => {
      const data = await loadCsv(dataDir, source.source_file);
      resistanceData.set(source.id, data);
    }),
  );

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
