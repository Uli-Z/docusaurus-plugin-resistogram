import { readFile } from "fs/promises";
import { join } from "path";
import { parse } from "csv-parse/sync";
import { Source } from "../types";

const CSV = (txt: string) =>
  parse(txt, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    cast: (value, context) => {
      if (context.header) return value;
      if (context.column === 'resistance') return parseFloat(value);
      if (context.column === 'total') return parseInt(value, 10);
      return value;
    },
  });

const loadJson = (dir: string, file: string) =>
  readFile(join(dir, file), "utf8").then(JSON.parse);

const loadCsv = (dir: string, file: string) =>
  readFile(join(dir, file), "utf8").then(CSV);

export const loadSharedData = async (
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

  const abxClasses = abxData.classes;
  const abxItems = abxData.antibiotics;

  return { abxClasses, abxItems, org, sources };
};

export const loadResistanceDataForSource = (source: Source, dataDir: string) => {
  const csvPath = join(dataDir, source.file);
  return readFile(csvPath, "utf8").then(CSV);
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