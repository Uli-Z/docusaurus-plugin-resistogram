const { visit } = require('unist-util-visit');
const { toString } = require('mdast-util-to-string');
const escapeStringRegexp = require('escape-string-regexp').default;

// --- Helper functions ---
const parseDirective = (directive) => {
  const params = directive.trim().split(/\s+/);
  const config = { abx: 'auto', org: 'auto', source: 'auto' };
  for (const param of params) {
    const [key, value] = param.split('=');
    if (key && value && (key === 'abx' || key === 'org' || key === 'source')) {
      config[key] = value;
    }
  }
  return config;
};

const getEntitySearchTerms = (entity, locale) => {
  const terms = new Set();
  const value = entity['full_name_en'];
  if (value) terms.add(value.trim());
  return Array.from(terms).filter(Boolean);
};

const resolveEntityCodes = (param, pageText, entities, locale) => {
  if (param === 'all') return Object.keys(entities);
  const codes = new Set();
  if (param === 'auto') {
    for (const entity of Object.values(entities)) {
      const searchTerms = getEntitySearchTerms(entity, locale);
      for (const term of searchTerms) {
        const regex = new RegExp(`\\b${escapeStringRegexp(term)}\\b`, 'gi');
        if (regex.test(pageText)) codes.add(entity.amr_code);
      }
    }
  } else {
    param.split(',').forEach((code) => {
      const trimmedCode = code.trim();
      if (entities[trimmedCode]) {
        codes.add(trimmedCode);
      }
    });
  }
  return Array.from(codes);
};

const pruneSourceTree = (node, relevantSourceIds) => {
  if (!node) return null;
  const keptChildren = node.children
    .map((child) => pruneSourceTree(child, relevantSourceIds))
    .filter((child) => child !== null);
  if (relevantSourceIds.has(node.id) || keptChildren.length > 0) {
    return { ...node, children: keptChildren };
  }
  return null;
};

const findDeepestLeaf = (root) => {
  if (!root) return null;
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

// --- The Remark Transformer ---
function remarkResistogram(options) {
  const { csvData } = options;
  if (!csvData || !csvData.sourceTree) {
    console.log('--- [Resistogram-Debug] Transformer exiting early: No csvData or sourceTree. ---');
    return () => {};
  }

  return (tree, file) => {
    const { antibiotics, organisms, sourceTree, resistance } = csvData;
    const pageText = toString(tree);
    const locale = file.data.i18n?.currentLocale ?? 'en';
    let resistanceTableUsed = false;

    visit(tree, 'paragraph', (node, index, parent) => {
      if (index === undefined || !parent) return;
      const textContent = toString(node);
      const match = textContent.match(/^%%RESIST(.*?)%%$/);
      if (!match) return;

      resistanceTableUsed = true;
      const directive = match[1] ?? '';
      const config = parseDirective(directive);
      const abxCodes = resolveEntityCodes(config.abx, pageText, antibiotics, locale);
      const orgCodes = resolveEntityCodes(config.org, pageText, organisms, locale);
      const relevantResistance = {};
      const relevantSourceIds = new Set();

      if (resistance) {
        for (const [sourceId, resData] of Object.entries(resistance)) {
          const filteredData = resData.filter(
            (r) =>
              abxCodes.includes(r.antibiotic_id) &&
              orgCodes.includes(r.organism_id),
          );
          if (filteredData.length > 0) {
            relevantResistance[sourceId] = filteredData;
            relevantSourceIds.add(sourceId);
          }
        }
      }

      const prunedAntibiotics = Object.fromEntries(
        Object.entries(antibiotics).filter(([key]) => abxCodes.includes(key)),
      );
      const prunedOrganisms = Object.fromEntries(
        Object.entries(organisms).filter(([key]) => orgCodes.includes(key)),
      );
      const prunedSourceTree = pruneSourceTree(sourceTree, relevantSourceIds);

      if (!prunedSourceTree) {
        parent.children.splice(index, 1);
        return;
      }
      
      let defaultSourceId = findDeepestLeaf(prunedSourceTree)?.id;

      const props = {
        antibiotics: prunedAntibiotics,
        organisms: prunedOrganisms,
        resistance: Object.fromEntries(relevantResistance),
        sourceTree: prunedSourceTree,
        defaultSourceId,
        locale,
      };

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
}

module.exports = remarkResistogram;