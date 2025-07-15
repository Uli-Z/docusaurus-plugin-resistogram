import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
import type { Root } from 'mdast';
import type { Plugin } from 'unified';
import type { VFile } from 'vfile';
import escapeStringRegexp from 'escape-string-regexp';
import type {
  LoadedData,
  Antibiotic,
  Organism,
  DataSourceNode,
  Resistance,
} from '../types';

// --- Helper Functions ---

/**
 * Parses the %%RESIST directive string to extract parameters.
 * Example: "abx=auto org=E_COLI,S_AUREUS source=de-ars-2023"
 */
const parseDirective = (
  directive: string,
): { abx: string; org: string; source: string } => {
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
const getTranslatedValue = (
  item: any,
  fieldName: string,
  locale: string,
): string => {
  return item[`${fieldName}_${locale}`] ?? item[`${fieldName}_en`] ?? '';
};

/**
 * Resolves entity codes from a parameter (e.g., 'auto', 'all', or 'CODE1,CODE2').
 */
const resolveEntityCodes = (
  param: string,
  pageText: string,
  entities: Map<string, Antibiotic | Organism>,
  locale: string,
): string[] => {
  if (param === 'all') {
    return Array.from(entities.keys());
  }

  const codes = new Set<string>();
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
const pruneSourceTree = (
  node: DataSourceNode,
  relevantSourceIds: Set<string>,
): DataSourceNode | null => {
  const keptChildren = node.children
    .map((child) => pruneSourceTree(child, relevantSourceIds))
    .filter((child): child is DataSourceNode => child !== null);

  if (relevantSourceIds.has(node.id) || keptChildren.length > 0) {
    return { ...node, children: keptChildren };
  }

  return null;
};

/**
 * Finds the deepest leaf node in a source tree.
 */
const findDeepestLeaf = (root: DataSourceNode): DataSourceNode => {
  let deepestLeaf = root;
  let maxDepth = 0;

  const traverse = (node: DataSourceNode, depth: number) => {
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

const remarkPlugin: Plugin<[LoadedData], Root> = (loadedData) => {
  if (!loadedData) {
    // Data not loaded, do nothing. This can happen during development.
    return;
  }

  const { antibiotics, organisms, sourceTree, resistance } = loadedData;

  return (tree: Root, file: VFile) => {
    console.log(`[Remark Plugin] Processing file: ${file.path}`);
    const pageText = toString(tree);
    const locale = (file.data.i18n as any)?.currentLocale ?? 'en';
    let resistanceTableUsed = false;

    // ... (imports and helper functions remain the same)

    visit(tree, 'paragraph', (node, index, parent) => {
      if (index === undefined || !parent) return;

      const textContent = toString(node);
      const match = textContent.match(/^%%RESIST(.*?)%%$/);
      if (!match) return;

      resistanceTableUsed = true;

      // ... (rest of the logic: parsing, pruning, etc.)

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

    // ... (import statement logic remains the same)
  };
};

export default remarkPlugin;
