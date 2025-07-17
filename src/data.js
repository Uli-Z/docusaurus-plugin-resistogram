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

const loadCsvSync = (dir, file) => {
  const content = readFileSync(join(dir, file), 'utf8');
  return parseCsv(content);
};

const buildSourceTree = (sources) => {
  const nodes = {};
  let root = null;

  for (const source of sources) {
    const node = { ...source, children: [] };
    nodes[node.id] = node;
    if (!node.parent_id) {
      root = node;
    }
  }

  for (const node of Object.values(nodes)) {
    if (node.parent_id) {
      const parent = nodes[node.parent_id];
      if (parent) {
        parent.children.push(node);
      }
    }
  }

  if (!root) {
    if (sources.length === 1) return { ...sources[0], children: [] };
    throw new Error('Could not determine the root of the data source tree. Ensure one source has no parent_id.');
  }

  return root;
};

exports.loadAllDataSync = (dir, opts = {}) => {
  const files = {
    antibiotics: opts.antibiotics ?? 'antibiotics.csv',
    organisms: opts.organisms ?? 'organisms.csv',
    sources: opts.sources ?? 'data_sources.csv',
  };

  const antibiotics = loadCsvSync(dir, files.antibiotics);
  const organisms = loadCsvSync(dir, files.organisms);
  const sources = loadCsvSync(dir, files.sources);

  const resistance = {};
  for (const row of sources) {
    resistance[row.id] = loadCsvSync(dir, row.source_file);
  }
  
  const sourceTree = buildSourceTree(sources);

  const antibioticsObj = Object.fromEntries(antibiotics.map((abx) => [abx.amr_code, abx]));
  const organismsObj = Object.fromEntries(organisms.map((org) => [org.amr_code, org]));

  return { 
    antibiotics: antibioticsObj, 
    organisms: organismsObj, 
    sources, 
    resistance,
    sourceTree 
  };
};