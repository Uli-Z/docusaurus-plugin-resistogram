import { visit, SKIP } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import { getSharedData, resolveIds, selectDataSource, loadResistanceDataForSource } from "../data";
import { join } from "path";
import chalk from 'chalk';

// AST → Plaintext (robust for MD/MDX, excluding code, inlineCode, and %%RESIST paragraphs)
export function mdastToPlainText(root: any): string {
  let out = "";
  const push = (s: string) => {
    if (!s) return;
    if (out && !/\s$/.test(out)) out += " ";
    out += s;
  };

  visit(root, (node) => {
    // --- Skip rules ---------------------------------------------------------

    // Skip entire code blocks and inline code.
    if (node.type === "code" || node.type === "inlineCode") return SKIP;

    // Skip paragraphs that contain a %%RESIST directive.
    if (node.type === "paragraph" && /%%RESIST/.test(toString(node))) return SKIP;

    // --- Headings -----------------------------------------------------------

    // Plain Markdown headings (# Title) are "heading" nodes.
    // Extract their text once as a whole and skip visiting children
    // to avoid double counting.
    if (node.type === "heading") {
      push(toString(node));
      return SKIP;
    }

    // MDX JSX elements may represent headings too, e.g. <h2>…</h2> or <Heading>…</Heading>.
    // Detect those and extract their text. For other MDX elements,
    // keep traversing so text children are collected normally.
    if (
      node.type === "mdxJsxFlowElement" ||
      node.type === "mdxJsxTextElement"
    ) {
      const name = (node as any).name?.toLowerCase?.();
      if (name && (/^h[1-6]$/.test(name) || name.includes("heading"))) {
        push(toString(node));
        return SKIP;
      }
    }

    // --- Plain text ---------------------------------------------------------

    // Collect raw text node values.
    if (node.type === "text") {
      push((node as any).value as string);
    }

    // Replace line breaks with spaces to keep words separated.
    if (node.type === "break") out += " ";
  });

    // Normalize whitespace: collapse multiple spaces and trim.
    const compact = out.replace(/\s+/g, " ").trim();
    // Surround with spaces so word-boundary regexes (`\b`) work reliably at edges.
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
    const tokenRegex = /"([^\"]*)"|'([^']*)'|([^,]+)/g;
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
    // Extract plain text from the AST
    let pageText = mdastToPlainText(tree);

    // --- Add title from frontmatter if present -------------------------------
    // In Docusaurus, parsed frontmatter is available on file.data.frontmatter
    const fm = (file.data && (file.data as any).frontmatter) || {};
    if (fm.title) {
      // Surround with spaces so word-boundary regexes still work
      pageText = ` ${fm.title} ${pageText}`;
    }

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
        orgGroups: files.orgGroups ?? "organism_groups.csv",
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

      // --- Build-Time Data Validation ---
      const logWarning = (message: string) => {
        console.warn(
          chalk.yellow(`[docusaurus-plugin-resistogram] Warning in ${file.path}:\n${message}\n`)
        );
      };

      // Show details about which params were "auto" and what failed
      const autoInfo: string[] = [];
      if (abxParam === "auto") {
        autoInfo.push("antibiotics=auto → resolved against page text");
      }
      if (orgParam === "auto") {
        autoInfo.push("organisms=auto → resolved against page text");
      }

      if (unresolvedAbx.length > 0 || unresolvedOrg.length > 0) {
        const unresolved = [...unresolvedAbx, ...unresolvedOrg];
        logWarning(
          `Unrecognized identifiers in "%%RESIST ${paramsStr}%%": ${unresolved.join(
            ", "
          )}.
          Resolved antibiotics: ${JSON.stringify(antibioticIds)}.
          Resolved organisms: ${JSON.stringify(organismIds)}.
          ${autoInfo.length ? "Parameter mode: " + autoInfo.join("; ") : ""}`
        );
      } else if (antibioticIds.length === 0 || organismIds.length === 0) {
        logWarning(
          `The directive "%%RESIST ${paramsStr}%%" did not resolve to any valid antibiotics or organisms.
          Resolved antibiotics: ${JSON.stringify(antibioticIds)}.
          Resolved organisms: ${JSON.stringify(organismIds)}.
          ${autoInfo.length ? "Parameter mode: " + autoInfo.join("; ") : ""}`
        );
      } else {
        const resistanceData = await loadResistanceDataForSource(
          selectedSource,
          sharedData.sources,
          dataPath
        );
        const hasData = resistanceData.some(
          (row) =>
          antibioticIds.includes(row.antibiotic_id) &&
          organismIds.includes(row.organism_id)
        );
        if (!hasData) {
          logWarning(
            `No resistance data found for the combination in "%%RESIST ${paramsStr}%%".
            Resolved antibiotics: ${JSON.stringify(antibioticIds)}.
            Resolved organisms: ${JSON.stringify(organismIds)}.
            ${autoInfo.length ? "Parameter mode: " + autoInfo.join("; ") : ""}`
          );
        }
      }
      // --- End Validation ---

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
