import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";

export default function remarkResist() {
  return (tree: any) => {
    let resistanceTableUsed = false;
    const pageText = tree.children.map((c: any) => toString(c)).join('\n\n');

    visit(tree, "paragraph", (node: any, i: number, parent: any) => {
      const txt = node.children.map((c: any) => c.value ?? "").join("").trim();
      const m = txt.match(/^%%RESIST([^%]*)%%$/);
      if (!m) return;

      resistanceTableUsed = true;

      const kv = Object.fromEntries(
        m[1].trim().split(/\s+/).map((p) => p.split("="))
      ) as Record<string, string>;

      const paramStr = Object.entries(kv)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");

      parent.children.splice(i, 1, {
        type: "mdxJsxFlowElement",
        name: "ResistanceTable",
        attributes: [
          { type: "mdxJsxAttribute", name: "params", value: paramStr },
          {
            type: "mdxJsxAttribute",
            name: "pageText",
            value: pageText,
          },
        ],
        children: [],
      });

      
    });

    if (resistanceTableUsed) {
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
    }
  };
}