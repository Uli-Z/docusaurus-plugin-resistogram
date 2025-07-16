const { visit } = require('unist-util-visit');
const { toString } = require('mdast-util-to-string');
const escapeStringRegexp = require('escape-string-regexp').default;
const { readJsonSync } = require('fs-extra');
const { u } = require('unist-builder');

// --- Helper Functions ---

// Helper to revive Maps from JSON, as they are not supported by default
const reviver = (key, value) => {
  if (typeof value === 'object' && value !== null) {
    if (value.dataType === 'Map') {
      return new Map(value.value);
    }
  }
  return value;
};

/**
 * Parses the %%RESIST directive string to extract parameters.
 * Example: "abx=auto org=E_COLI,S_AUREUS source=de-ars-2023"
 */
const parseDirective = (directive) => {
  const params = directive.trim().split(/\s+/);
  const config = {
    abx: 'auto',
    org: 'auto',
    source: 'auto',
  };
  for (const param of params) {
    const [key, value] = param.split('=');
    if (key && value && (key === 'abx' || key === 'org' || key === 'source')) {
      config[key] = value;
    }
  }
  return config;
};

/**
 * Gets a translated value from an object, with a fallback to English.
 */
const getTranslatedValue = (item, fieldName, locale) => {
  return item[`${fieldName}_${locale}`] ?? item[`${fieldName}_en`] ?? '';
};

/**
 * Resolves entity codes from a parameter (e.g., 'auto', 'all', or 'CODE1,CODE2').
 */
const resolveEntityCodes = (param, pageText, entities, locale) => {
  if (param === 'all') {
    return Array.from(entities.keys());
  }

  const codes = new Set();
  if (param === 'auto') {
    for (const entity of entities.values()) {
      const synonyms = getTranslatedValue(entity, 'synonyms', locale)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const synonym of synonyms) {
        // Use a regex to find whole words to avoid partial matches
        const regex = new RegExp(`\\b${escapeStringRegexp(synonym)}\\b`, 'gi');
        if (regex.test(pageText)) {
          codes.add(entity.amr_code);
        }
      }
    }
  } else {
    param.split(',').forEach((code) => {
      if (entities.has(code.trim())) {
        codes.add(code.trim());
      }
    });
  }
  return Array.from(codes);
};

/**
 * Recursively prunes the data source tree. A node is kept if it has relevant
 * data itself or if any of its children are kept.
 */
const pruneSourceTree = (node, relevantSourceIds) => {
  const keptChildren = node.children
    .map((child) => pruneSourceTree(child, relevantSourceIds))
    .filter((child) => child !== null);

  if (relevantSourceIds.has(node.id) || keptChildren.length > 0) {
    return { ...node, children: keptChildren };
  }

  return null;
};

/**
 * Finds the deepest leaf node in a source tree.
 */
const findDeepestLeaf = (root) => {
  let deepestLeaf = root;
  let maxDepth = 0;

  const traverse = (node, depth) => {
    if (depth > maxDepth && node.children.length === 0) {
      maxDepth = depth;
      deepestLeaf = node;
    }
    for (const child of node.children) {
      traverse(child, depth + 1);
    }
  };

  traverse(root, 0);
  return deepestLeaf;
};

// --- The Remark Plugin ---

const remarkPlugin = (options) => {
  console.log('[Resistogram Remark] Plugin initialized with options:', options);
  let loadedData = null;

  // This function will be called for each MDX file.
  return (tree, file) => {
    console.log(
      '[Resistogram Remark] Transformer running for file:',
      file.path,
    );
    // Lazy-load the data on the first run.
    if (!loadedData) {
      try {
        loadedData = readJsonSync(options.dataPath, { reviver });
      } catch (e) {
        console.error(
          `[Resistogram Plugin] Failed to load data from ${options.dataPath}`,
          e,
        );
        // If data can't be loaded, we can't do anything.
        return;
      }
    }

    // If data loading failed or the file doesn't exist, stop.
    if (!loadedData) {
      return;
    }

    // De-structure here, inside the transformer.
    const { antibiotics, organisms, sourceTree, resistance } = loadedData;

    const pageText = toString(tree);
    const locale = file.data.i18n?.currentLocale ?? 'en';
    let resistanceTableUsed = false;

    visit(tree, 'paragraph', (node, index, parent) => {
      console.log('[Resistogram Remark] Visiting paragraph.');
      if (index === undefined || !parent) return;

      const textContent = toString(node);
      const match = textContent.match(/^%%RESIST(.*?)%%$/);
      if (!match) return;

      console.log('[Resistogram Remark] Found directive:', textContent);

      resistanceTableUsed = true;

      const directive = match[1] ?? '';
      const config = parseDirective(directive);

      // 2. Resolve entity codes
      const abxCodes = resolveEntityCodes(
        config.abx,
        pageText,
        antibiotics,
        locale,
      );
      const orgCodes = resolveEntityCodes(
        config.org,
        pageText,
        organisms,
        locale,
      );

      // 3. Filter relevant resistance data and sources
      const relevantResistance = new Map();
      const relevantSourceIds = new Set();

      for (const [sourceId, resData] of resistance.entries()) {
        const filteredData = resData.filter(
          (r) =>
            abxCodes.includes(r.antibiotic_id) &&
            orgCodes.includes(r.organism_id),
        );
        if (filteredData.length > 0) {
          relevantResistance.set(sourceId, filteredData);
          relevantSourceIds.add(sourceId);
        }
      }

      // 4. Prune the data for the component
      const prunedAntibiotics = Object.fromEntries(
        Array.from(antibiotics.entries()).filter(([key]) =>
          abxCodes.includes(key),
        ),
      );
      const prunedOrganisms = Object.fromEntries(
        Array.from(organisms.entries()).filter(([key]) =>
          orgCodes.includes(key),
        ),
      );
      const prunedSourceTree = pruneSourceTree(sourceTree, relevantSourceIds);

      if (!prunedSourceTree) {
        console.warn(
          '[Resistogram Plugin] No relevant data found for directive:',
          directive,
        );
        parent.children.splice(index, 1); // Remove the directive node
        return;
      }

      // 5. Determine the default source
      const defaultSourceId =
        config.source === 'auto'
          ? findDeepestLeaf(prunedSourceTree).id
          : config.source;

      const props = {
        antibiotics: prunedAntibiotics,
        organisms: prunedOrganisms,
        resistance: Object.fromEntries(relevantResistance),
        sourceTree: prunedSourceTree,
        defaultSourceId,
        locale,
      };

      // 6. Replace the paragraph node with the JSX component
      const jsxNode = {
        type: 'mdxJsxFlowElement',
        name: 'ResistanceTable',
        attributes: [
          {
            type: 'mdxJsxAttribute',
            name: 'data',
            value: JSON.stringify(props),
          },
        ],
        children: [],
      };

      parent.children.splice(index, 1, jsxNode);
    });

    if (resistanceTableUsed) {
      // Add the import statement for the ResistanceTable component
      tree.children.unshift({
        type: 'mdxjsEsm',
        value: "import ResistanceTable from '@theme/ResistanceTable';",
        data: {
          estree: {
            type: 'Program',
            body: [
              {
                type: 'ImportDeclaration',
                specifiers: [
                  {
                    type: 'ImportDefaultSpecifier',
                    local: { type: 'Identifier', name: 'ResistanceTable' },
                  },
                ],
                source: {
                  type: 'Literal',
                  value: '@theme/ResistanceTable',
                  raw: "'@theme/ResistanceTable'",
                },
              },
            ],
            sourceType: 'module',
          },
        },
      });
    }
  };
};

module.exports = remarkPlugin;