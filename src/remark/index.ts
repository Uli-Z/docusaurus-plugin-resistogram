import { visit, SKIP } from "unist-util-visit";
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
      return SKIP;
    }
    if (node.type === "paragraph" && /%%RESIST/.test(toString(node))) {
       return SKIP;
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
  // This regex is designed to capture a key, and then the entire value until the next key.
  const regex = /(\w+)=/g;
  const matches = Array.from(s.matchAll(regex));

  matches.forEach((match, i) => {
    const key = match[1];
    const start = match.index! + match[0].length;
    const nextMatch = matches[i + 1];
    const end = nextMatch ? nextMatch.index : s.length;
    const value = s.substring(start, end).trim();

    // Now, clean the value. The goal is to get a simple comma-separated string.
    // e.g., from '"S. aureus","S. epidermidis"' to 'S. aureus,S. epidermidis'
    // e.g., from '"S. aureus,S. epidermidis"' to 'S. aureus,S. epidermidis'
    const tokens = [];
    // This regex finds quoted strings or unquoted chunks between commas.
    const tokenRegex = /"([^"]*)"|'([^']*)'|([^,]+)/g;
    let tokenMatch;
    while ((tokenMatch = tokenRegex.exec(value)) !== null) {
      // The matched value is in one of the capture groups.
      const token = tokenMatch[1] ?? tokenMatch[2] ?? tokenMatch[3] ?? '';
      tokens.push(token.trim());
    }
    
    // If the regex didn't match (e.g., empty string), handle it gracefully.
    if (tokens.length > 0) {
      params[key] = tokens.join(',');
    } else if (value) {
      // Fallback for values that might not be captured by the regex but are not empty.
      params[key] = value;
    }
  });

  return params;
};

export default function remarkResistogram(options: { dataDir?: string, files?: any, pluginId?: string }) {
  const { dataDir = "data", files = {}, pluginId = 'default' } = options;

  return async (tree: any, file: any) => {
    const pageText = mdastToPlainText(tree);
    const nodesToProcess: any[] = [];

    visit(tree, "paragraph", (node: any, index: number | undefined, parent: any) => {
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
        abxClasses: files.abxClasses ?? "antibiotic_classes.csv",
        orgClasses: files.orgClasses ?? "organism_classes.csv",
    });

    let importAdded = false;

    for (let i = nodesToProcess.length - 1; i >= 0; i--) {
      const { node, index, parent } = nodesToProcess[i];
      const text = toString(node);
      const regex = /%%RESIST\s*([^%]*)%%/;
      const match = text.match(regex);

      if (!match || match.index === undefined) continue;

      const beforeText = text.slice(0, match.index).trim();
      const afterText = text.slice(match.index + match[0].length).trim();
      
      const paramsStr = match[1];
      const params = parseParams(paramsStr);
      const abxParam = params.abx ?? 'auto';
      const orgParam = params.org ?? 'auto';

      const { resolved: antibioticIds, unresolved: unresolvedAbx } = resolveIds(abxParam, sharedData.allAbxIds, sharedData.abxSyn2Id, pageText);
      const { resolved: organismIds, unresolved: unresolvedOrg } = resolveIds(orgParam, sharedData.allOrgIds, sharedData.orgSyn2Id, pageText);
      const selectedSource = selectDataSource(params.source, sharedData.sources);

      const resistogramNode = {
        type: "mdxJsxFlowElement",
        name: "ResistanceTable",
        attributes: [
          { type: "mdxJsxAttribute", name: "antibioticIds", value: JSON.stringify(antibioticIds) },
          { type: "mdxJsxAttribute", name: "organismIds", value: JSON.stringify(organismIds) },
          { type: "mdxJsxAttribute", name: "unresolvedAbx", value: JSON.stringify(unresolvedAbx) },
          { type: "mdxJsxAttribute", name: "unresolvedOrg", value: JSON.stringify(unresolvedOrg) },
          { type: "mdxJsxAttribute", name: "dataSourceId", value: selectedSource.id },
          { type: "mdxJsxAttribute", name: "pluginId", value: pluginId },
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

      if (newNodes.length > 0 && index !== undefined) {
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