import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import { getSharedData, resolveIds, selectDataSource } from "../data";
import { join } from "path";

// AST → Plaintext (robust über MD/MDX, ohne Code/InlineCode, ohne %%RESIST-Zeilen)
export function mdastToPlainText(root: any): string {
  let out = "";
  const push = (s: string) => {
    if (!s) return;
    if (out && !/\s$/.test(out)) out += " ";
    out += s;
  };

  visit(root, (node) => {
    if (node.type === "code" || node.type === "inlineCode") {
      return visit.SKIP;
    }
    if (node.type === "paragraph" && /%%RESIST/.test(toString(node))) {
       return visit.SKIP;
    }
    if (node.type === "text") {
      push(node.value as string);
    }
    if (node.type === "break") {
      out += " ";
    }
  });

  const compact = out.replace(/\s+/g, " ").trim();
  return ` ${compact} `;
}

const parseParams = (s: string): Record<string, string> => {
  const params: Record<string, string> = {};
  const regex = /(\w+)=("([^"]*)"|'([^']*)'|(\S+))/g;
  let match;
  while ((match = regex.exec(s)) !== null) {
    const key = match[1];
    const value = match[3] ?? match[4] ?? match[5];
    params[key] = value;
  }
  return params;
};

export default function remarkResistogram(options: { dataDir?: string, files?: any }) {
  const { dataDir = "data", files = {} } = options;

  return async (tree: any, file: any) => {
    const pageText = mdastToPlainText(tree);
    const nodesToProcess: any[] = [];

    visit(tree, "paragraph", (node: any, index: number, parent: any) => {
      if (toString(node).includes("%%RESIST")) {
        nodesToProcess.push({ node, index, parent });
      }
    });

    if (nodesToProcess.length === 0) return;

    const siteDir = file.cwd;
    const dataPath = join(siteDir, dataDir);
    const sharedData = await getSharedData(dataPath, {
        antibiotics: files.antibiotics ?? "antibiotics.csv",
        organisms: files.organisms ?? "organisms.csv",
        sources: files.sources ?? "data_sources.csv",
    });

    let importAdded = false;

    for (let i = nodesToProcess.length - 1; i >= 0; i--) {
      const { node, index, parent } = nodesToProcess[i];
      const text = toString(node);
      const regex = /%%RESIST\s+([^%]*)%%/;
      const match = text.match(regex);

      if (!match) continue;

      const beforeText = text.slice(0, match.index).trim();
      const afterText = text.slice(match.index + match[0].length).trim();
      
      const paramsStr = match[1];
      const params = parseParams(paramsStr);
      const antibioticIds = resolveIds(params.abx, sharedData.allAbxIds, sharedData.abxSyn2Id, pageText);
      const organismIds = resolveIds(params.org, sharedData.allOrgIds, sharedData.orgSyn2Id, pageText);
      const selectedSource = selectDataSource(params.src, sharedData.sources);

      const resistogramNode = {
        type: "mdxJsxFlowElement",
        name: "ResistanceTable",
        attributes: [
          { type: "mdxJsxAttribute", name: "antibioticIds", value: JSON.stringify(antibioticIds) },
          { type: "mdxJsxAttribute", name: "organismIds", value: JSON.stringify(organismIds) },
          { type: "mdxJsxAttribute", name: "dataSourceId", value: selectedSource.id },
          ...Object.entries(params).map(([key, value]) => ({
            type: "mdxJsxAttribute", name: key, value: value
          })),
        ],
        children: [],
      };
      importAdded = true;

      const newNodes = [];
      if (beforeText) {
        newNodes.push({ type: 'paragraph', children: [{ type: 'text', value: beforeText }] });
      }
      newNodes.push(resistogramNode);
      if (afterText) {
        newNodes.push({ type: 'paragraph', children: [{ type: 'text', value: afterText }] });
      }

      if (newNodes.length > 0) {
        parent.children.splice(index, 1, ...newNodes);
      }
    }

    if (importAdded) {
      tree.children.unshift({
        type: "mdxjsEsm",
        value: "import ResistanceTable from '@theme/ResistanceTable';",
        data: { estree: { type: "Program", body: [ { type: "ImportDeclaration", specifiers: [ { type: "ImportDefaultSpecifier", local: { type: "Identifier", name: "ResistanceTable" }, }, ], source: { type: "Literal", value: "@theme/ResistanceTable", raw: "'@theme/ResistanceTable'", }, }, ], sourceType: "module", }, },
      });
    }

    return tree;
  };
}


