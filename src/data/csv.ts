import { readFile } from "fs/promises";
import { join } from "path";
import { parse } from "csv-parse/sync";

export const CSV = (txt: string) => parse(txt, { columns: true });

export const loadCsv = async (dir: string, files: string[]) =>
  Promise.all(files.map(f => readFile(join(dir, f), "utf8").then(CSV)));

export const mkSynMap = (rows: any[]) =>
  rows.reduce<Map<string, string>>((m, r) => {
    (r.synonyms || "").split(",").forEach((s: string) =>
      m.set(s.trim().toLowerCase(), r.id)
    );
    if (r.full_name)  m.set(r.full_name.trim().toLowerCase(),  r.id);
    if (r.short_name) m.set(r.short_name.trim().toLowerCase(), r.id);
    return m;
  }, new Map());