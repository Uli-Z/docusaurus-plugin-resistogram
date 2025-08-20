import {
  getSharedData,
  resolveIds,
  selectDataSource
} from "../chunk-M23YCPVN.mjs";

// src/remark/index.ts
import { visit, SKIP } from "unist-util-visit";

// node_modules/mdast-util-to-string/lib/index.js
var emptyOptions = {};
function toString(value, options) {
  const settings = options || emptyOptions;
  const includeImageAlt = typeof settings.includeImageAlt === "boolean" ? settings.includeImageAlt : true;
  const includeHtml = typeof settings.includeHtml === "boolean" ? settings.includeHtml : true;
  return one(value, includeImageAlt, includeHtml);
}
function one(value, includeImageAlt, includeHtml) {
  if (node(value)) {
    if ("value" in value) {
      return value.type === "html" && !includeHtml ? "" : value.value;
    }
    if (includeImageAlt && "alt" in value && value.alt) {
      return value.alt;
    }
    if ("children" in value) {
      return all(value.children, includeImageAlt, includeHtml);
    }
  }
  if (Array.isArray(value)) {
    return all(value, includeImageAlt, includeHtml);
  }
  return "";
}
function all(values, includeImageAlt, includeHtml) {
  const result = [];
  let index = -1;
  while (++index < values.length) {
    result[index] = one(values[index], includeImageAlt, includeHtml);
  }
  return result.join("");
}
function node(value) {
  return Boolean(value && typeof value === "object");
}

// src/remark/index.ts
import { join } from "path";
function mdastToPlainText(root) {
  let out = "";
  const push = (s) => {
    if (!s) return;
    if (out && !/\s$/.test(out)) out += " ";
    out += s;
  };
  visit(root, (node2) => {
    if (node2.type === "code" || node2.type === "inlineCode") {
      return SKIP;
    }
    if (node2.type === "paragraph" && /%%RESIST/.test(toString(node2))) {
      return SKIP;
    }
    if (node2.type === "text") {
      push(node2.value);
    }
    if (node2.type === "break") {
      out += " ";
    }
  });
  const compact = out.replace(/\s+/g, " ").trim();
  return ` ${compact} `;
}
var parseParams = (s) => {
  const params = {};
  const regex = /(\w+)=/g;
  const matches = Array.from(s.matchAll(regex));
  matches.forEach((match, i) => {
    const key = match[1];
    const start = match.index + match[0].length;
    const nextMatch = matches[i + 1];
    const end = nextMatch ? nextMatch.index : s.length;
    const value = s.substring(start, end).trim();
    const tokens = [];
    const tokenRegex = /"([^"]*)"|'([^']*)'|([^,]+)/g;
    let tokenMatch;
    while ((tokenMatch = tokenRegex.exec(value)) !== null) {
      const token = tokenMatch[1] ?? tokenMatch[2] ?? tokenMatch[3] ?? "";
      tokens.push(token.trim());
    }
    if (tokens.length > 0) {
      params[key] = tokens.join(",");
    } else if (value) {
      params[key] = value;
    }
  });
  return params;
};
function remarkResistogram(options) {
  const { dataDir = "data", files = {}, pluginId = "default" } = options;
  return async (tree, file) => {
    const pageText = mdastToPlainText(tree);
    const nodesToProcess = [];
    visit(tree, "paragraph", (node2, index, parent) => {
      if (toString(node2).includes("%%RESIST")) {
        nodesToProcess.push({ node: node2, index, parent });
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
      orgClasses: files.orgClasses ?? "organism_classes.csv"
    });
    let importAdded = false;
    for (let i = nodesToProcess.length - 1; i >= 0; i--) {
      const { node: node2, index, parent } = nodesToProcess[i];
      const text = toString(node2);
      const regex = /%%RESIST\s*([^%]*)%%/;
      const match = text.match(regex);
      if (!match || match.index === void 0) continue;
      const beforeText = text.slice(0, match.index).trim();
      const afterText = text.slice(match.index + match[0].length).trim();
      const paramsStr = match[1];
      const params = parseParams(paramsStr);
      const { resolved: antibioticIds, unresolved: unresolvedAbx } = resolveIds(params.abx, sharedData.allAbxIds, sharedData.abxSyn2Id, pageText);
      const { resolved: organismIds, unresolved: unresolvedOrg } = resolveIds(params.org, sharedData.allOrgIds, sharedData.orgSyn2Id, pageText);
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
            type: "mdxJsxAttribute",
            name: key,
            value
          }))
        ],
        children: []
      };
      importAdded = true;
      const newNodes = [];
      if (beforeText) {
        newNodes.push({ type: "paragraph", children: [{ type: "text", value: beforeText }] });
      }
      newNodes.push(resistogramNode);
      if (afterText) {
        newNodes.push({ type: "paragraph", children: [{ type: "text", value: afterText }] });
      }
      if (newNodes.length > 0 && index !== void 0) {
        parent.children.splice(index, 1, ...newNodes);
      }
    }
    if (importAdded) {
      tree.children.unshift({
        type: "mdxjsEsm",
        value: "import ResistanceTable from '@theme/ResistanceTable';",
        data: { estree: { type: "Program", body: [{ type: "ImportDeclaration", specifiers: [{ type: "ImportDefaultSpecifier", local: { type: "Identifier", name: "ResistanceTable" } }], source: { type: "Literal", value: "@theme/ResistanceTable", raw: "'@theme/ResistanceTable'" } }], sourceType: "module" } }
      });
    }
    return tree;
  };
}
export {
  remarkResistogram as default,
  mdastToPlainText
};
