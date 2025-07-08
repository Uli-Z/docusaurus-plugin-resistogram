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
  files: {
    antibiotics: string;
    organisms: string;
    sources: string;
  }
) => {
  const [abxData, org, sources] = await Promise.all([
    loadJson(dir, files.antibiotics),
    loadJson(dir, files.organisms),
    loadJson(dir, files.sources),
  ]);

  const resistanceData = new Map<string, any[]>();
  for (const source of sources) {
    const csvData = await loadCsv(dir, source.file);
    resistanceData.set(source.file, csvData);
  }

  const abx = [...abxData.classes, ...abxData.antibiotics];

  return { abx, org, sources, resistanceData };
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