import { readFile } from "fs/promises";
import { join } from "path";
import { parse } from "csv-parse/sync";

const CSV = (txt: string) => parse(txt, { columns: true });

const loadJson = (dir: string, file: string) =>
  readFile(join(dir, file), "utf8").then(JSON.parse);

const loadCsv = (dir: string, file: string) =>
  readFile(join(dir, file), "utf8").then(CSV);

export const loadData = async (
  dir: string,
  files: { antibiotics: string; organisms: string; resistance: string }
) => {
  const [abxData, org, res] = await Promise.all([
    loadJson(dir, files.antibiotics),
    loadJson(dir, files.organisms),
    loadCsv(dir, files.resistance),
  ]);

  const abx = [...abxData.classes, ...abxData.antibiotics];

  return [abx, org, res];
};

export const mkSynMap = (rows: any[]) =>
  rows.reduce<Map<string, string>>((m, r) => {
    for (const s of r.synonyms ?? []) {
      m.set(s.trim().toLowerCase(), r.id);
    }
    const name = r.full_name ?? r.name;
    if (name) m.set(name.trim().toLowerCase(), r.id);
    if (r.short_name) m.set(r.short_name.trim().toLowerCase(), r.id);
    return m;
  }, new Map());
