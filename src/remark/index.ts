import { visit } from "unist-util-visit";

export default function remarkResist() {
  return (tree: any) => {
    visit(tree, "paragraph", (node: any, i: number, parent: any) => {
      const txt = node.children.map((c: any) => c.value ?? "").join("").trim();
      const m = txt.match(/^%%RESIST([^%]*)%%$/);
      if (!m) return;

      const kv = Object.fromEntries(
        m[1].trim().split(/\s+/).map(p => p.split("="))
      ) as Record<string, string>;

      const paramStr = Object.entries(kv).map(([k, v]) => `${k}=${v}`).join(" ");

      parent.children.splice(i, 1, {
        type: "mdxJsxFlowElement",
        name: "ResistanceTable",
        attributes: [{ type: "mdxJsxAttribute", name: "params", value: paramStr }],
        children: []
      });

      return [visit.SKIP, i];
    });
  };
}