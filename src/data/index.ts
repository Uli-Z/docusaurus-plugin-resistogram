import { readFile } from "fs/promises";
import { join } from "path";
import { parse } from "csv-parse/sync";
import { Source } from "../types";

const CSV = (txt: string) =>
  parse(txt, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true, // Add this line to handle Byte Order Mark
    cast: (value, context) => {
      if (context.header) return value;
      if (context.column === 'resistance_pct') return parseFloat(value);
      if (context.column === 'n_isolates') return parseInt(value, 10);
      return value;
    },
  });

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
  const [abx, org, sources] = await Promise.all([
    loadCsv(dir, files.antibiotics),
    loadCsv(dir, files.organisms),
    loadCsv(dir, files.sources),
  ]);

  return { abx, org, sources };
};

export const loadResistanceDataForSource = (source: Source, dataDir: string) => {
  const csvPath = join(dataDir, source.source_file);
  return readFile(csvPath, "utf8").then(CSV);
};

export const mkSynMap = (rows: any[]) =>
  rows.reduce<Map<string, string>>((m, r) => {
    // Synonyms are in a single string, separated by semicolons
    for (const s of (r.synonyms_de ?? '').split(';')) {
      if (s) m.set(s.trim().toLowerCase(), r.amr_code);
    }
    // Add full name and short name to the map
    if (r.full_name_de) m.set(r.full_name_de.trim().toLowerCase(), r.amr_code);
    if (r.short_name_de) m.set(r.short_name_de.trim().toLowerCase(), r.amr_code);
    return m;
  }, new Map());
