import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import { getSharedData, resolveIds } from "../data";
import { join } from "path";

// AST → Plaintext (robust über MD/MDX, ohne Code/InlineCode, ohne %%RESIST-Zeilen)
export function mdastToPlainText(root: any): string {
  let out = "";
  const push = (s: string) => {
    if (!s) return;
    if (out && !/\s$/.test(out)) out += " ";
    out += s;
  };

  visit(root, (node, _idx, parent) => {
    // 1) Harte Skips
    if (node.type === "code" || node.type === "inlineCode") {
      return visit.SKIP;
    }
    // 2) %%RESIST-Absätze gar nicht in den Suchtext aufnehmen
    if (node.type === "paragraph") {
      const txt = toString(node).trim();
      if (/^%%RESIST([^%]*)%%$/.test(txt)) return visit.SKIP;
    }
    // 3) Relevanter Text kommt aus allen "text"-Kindern – egal in welchem Container
    if (node.type === "text") {
      push(node.value as string);
      return;
    }
    // 4) Zeilenumbrüche als Leerzeichen normalisieren
    if (node.type === "break") {
      out += " ";
      return;
    }
    // 5) Für alle Container (heading, emphasis, strong, link, listItem, mdxJsx* etc.)
    //     NICHT frühzeitig returnen → Kinder weiterbesuchen
    return;
  });

  // Stabiler, getrimmter Fließtext + Padding für sichere Wortgrenzen am Rand
  const compact = out.replace(/\s+/g, " ").trim();
  return ` ${compact} `;
}

// Helper to parse the parameter string from the markdown code block
const parseParams = (s: string): Record<string, string> => {
  const params: Record<string, string> = {};
  // This regex handles key=value pairs, where value can be a single word or a quoted string.
  const regex = /(\w+)=("([^"]*)"|'([^']*)'|(\S+))/g;
  let match;
  while ((match = regex.exec(s)) !== null) {
    const key = match[1];
    // The value is in one of the capturing groups, depending on whether it was double-quoted, single-quoted, or unquoted.
    const value = match[3] ?? match[4] ?? match[5];
    params[key] = value;
  }
  return params;
};

/**
 * This is a Docusaurus Remark plugin factory.
 * It's configured in docusaurus.config.js and receives the plugin options.
 */
export default function remarkResistogram(options: { dataDir?: string, files?: any }) {
  const { dataDir = "data", files = {} } = options;

  // The actual remark plugin, which has access to the options via closure.
  return async (tree: any, file: any) => {
    const pageText = mdastToPlainText(tree);
    const resistogramNodes: any[] = [];

    visit(tree, "paragraph", (node: any, index: number, parent: any) => {
      const text = toString(node).trim();
      const match = text.match(/^%%RESIST([^%]*)%%$/);
      if (match) {
        resistogramNodes.push({ node, index, parent, paramsStr: match[1] });
      }
    });

    if (resistogramNodes.length === 0) {
      return; // No resistogram blocks on this page
    }

    // All data loading and processing happens here, once per page, during build.
    const siteDir = file.cwd; // `cwd` is the site directory
    const dataPath = join(siteDir, dataDir);
    const { abxSyn2Id, orgSyn2Id, allAbxIds, allOrgIds } = await getSharedData(dataPath, {
        antibiotics: files.antibiotics ?? "antibiotics.csv",
        organisms: files.organisms ?? "organisms.csv",
        sources: files.sources ?? "data_sources.csv",
    });

    for (const { node, index, parent, paramsStr } of resistogramNodes) {
      const params = parseParams(paramsStr);

      // Resolve the 'auto' or 'all' params into concrete ID lists
      const antibioticIds = resolveIds(params.abx, allAbxIds, abxSyn2Id, pageText);
      const organismIds = resolveIds(params.org, allOrgIds, orgSyn2Id, pageText);

      // Create the new MDX node for the React component
      const mdxNode = {
        type: "mdxJsxFlowElement",
        name: "ResistanceTable",
        attributes: [
          { type: "mdxJsxAttribute", name: "antibioticIds", value: JSON.stringify(antibioticIds) },
          { type: "mdxJsxAttribute", name: "organismIds", value: JSON.stringify(organismIds) },
          // Pass through other parameters like layout, showEmpty etc.
          ...Object.entries(params).map(([key, value]) => ({
            type: "mdxJsxAttribute",
            name: key,
            value: value,
          })),
        ],
        children: [],
      };

      console.log(`[Resistogram Plugin] In ${file.history[0]}:`);
      console.log(`  - Found %%RESIST%% block with params:`, params);
      console.log(`  - Resolved organismIds:`, organismIds);
      console.log(`  - Resolved antibioticIds:`, antibioticIds);
      console.log(`  - Passing props to ResistanceTable component.`);

      // Replace the original paragraph node with the new component node
      parent.children.splice(index, 1, mdxNode);
    }

    // Add the import statement for the component to the top of the MDX file
    tree.children.unshift({
      type: "mdxjsEsm",
      value: "import ResistanceTable from '@theme/ResistanceTable';",
      data: {
        estree: {
          type: "Program",
          body: [
            {
              type: "ImportDeclaration",
              specifiers: [
                {
                  type: "ImportDefaultSpecifier",
                  local: { type: "Identifier", name: "ResistanceTable" },
                },
              ],
              source: {
                type: "Literal",
                value: "@theme/ResistanceTable",
                raw: "'@theme/ResistanceTable'",
              },
            },
          ],
          sourceType: "module",
        },
      },
    });

    return tree;
  };
}
