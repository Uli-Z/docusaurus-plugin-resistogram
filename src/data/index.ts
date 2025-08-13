import { readFile } from "fs/promises";
import { join } from "path";
import { parse } from "csv-parse/sync";
import { Source } from "../types";

// ============================================================================ 
// Data Loading and Caching
// ============================================================================ 

const CSV = (txt: string) =>
  parse(txt, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    cast: (value, context) => {
      if (context.header) return value;
      if (context.column === "resistance_pct") return parseFloat(value);
      if (context.column === "n_isolates") return parseInt(value, 10);
      return value;
    },
  });

const loadCsv = (dir: string, file: string) =>
  readFile(join(dir, file), "utf8").then(CSV);

let sharedDataPromise: Promise<any> | null = null;

export function getSharedData(
  dir: string,
  files: {
    antibiotics: string;
    organisms: string;
    sources: string;
  }
) {
  if (!sharedDataPromise) {
    sharedDataPromise = Promise.all([
      loadCsv(dir, files.antibiotics),
      loadCsv(dir, files.organisms),
      loadCsv(dir, files.sources),
    ]).then(([abx, org, sources]) => {
      const abxSyn2Id = mkSynMap(abx);
      const orgSyn2Id = mkSynMap(org);
      const allAbxIds = abx.filter((r: any) => r.class).map((r: any) => r.amr_code);
      const allOrgIds = org.filter((r: any) => r.class_id).map((r: any) => r.amr_code);

      return { abx, org, sources, abxSyn2Id, orgSyn2Id, allAbxIds, allOrgIds };
    });
  }
  return sharedDataPromise;
}

export const loadResistanceDataForSource = (source: Source, dataDir: string) => {
  const csvPath = join(dataDir, source.source_file);
  return readFile(csvPath, "utf8").then(CSV);
};

// ============================================================================ 
// Data Processing / ID Resolution (Final Corrected Version)
// ============================================================================ 

// Robustes Pattern ohne Lookbehind / \p{…}
const makeTokenRegex = (synRaw: string) => {
  const syn = synRaw?.trim();
  if (!syn) return null;

  const esc = (s: string) => s.replace(/[.*+?^${}()|[\\]/g, "\\$&");
  const parts = syn.split(/\s+/).map(esc);
  const core = parts.join("\\s+").replace(/\\\./g, "\\.?"); // "E\.? coli"

  // "Wortzeichen": Latein + Akzent + Ziffern (+ optional Griechisch)
  const W = "A-Za-z0-9\\u00C0-\u024F\u0370-\u03FF";
  const pattern = `(?:^|[^${W}])(${core})(?=$|[^${W}])`;

  return new RegExp(pattern, "i");
};

export const mkSynMap = (rows: any[]) =>
  rows.reduce<Map<string, string>>((m, r) => {
    const add = (s: string) => {
      if (!s) return;
      const t = s.trim();
      if (!t) return;
      m.set(t, r.amr_code);
      // Variante ohne Punkte (z. B. "E coli") zusätzlich erlauben
      const noDots = t.replace(/\./g, "");
      if (noDots !== t) m.set(noDots, r.amr_code);
    };
    (r.synonyms_de ?? "").split(";").forEach(add);
    add(r.full_name_de);
    add(r.short_name_de);
    add(r.amr_code);
    return m;
  }, new Map());

// Case-insensitive Map für manuellen Pfad (Caching)
const getLowerCaseSynMap = (() => {
  let cache: Map<string, string> | null = null;
  let originalMap: Map<string, string> | null = null;

  return (synMap: Map<string, string>) => {
    if (cache && originalMap === synMap) {
      return cache;
    }
    const lowerCaseMap = new Map<string, string>();
    synMap.forEach((value, key) => {
      lowerCaseMap.set(key.toLowerCase(), value);
    });
    cache = lowerCaseMap;
    originalMap = synMap;
    return lowerCaseMap;
  };
})();

// Auto-/Manuelle Auflösung
export const resolveIds = (
  param: string | undefined,
  allIds: string[],
  synMap: Map<string, string>,
  pageText: string,
): string[] => {
  // Auto-Modus
  if (param === "auto") {
    const detected = new Set<string>();
    // Der pageText wird vom Remark-Plugin bereits mit mdastToPlainText bereinigt.
    for (const [syn, id] of synMap.entries()) {
      const rx = makeTokenRegex(syn);
      if (rx && rx.test(pageText)) {
        detected.add(id);
      }
    }
    return [...detected];
  }

  // "all" oder leer: alles zurückgeben
  if (!param || param === "all") return allIds;

  // Manueller Pfad: kommagetrennte Liste (IDs oder Synonyme)
  const lowerCaseSynMap = getLowerCaseSynMap(synMap);
  const requested = param.split(",").map((t) => t.trim().toLowerCase());

  return Array.from(
    new Set(
      requested
        .map((t) => lowerCaseSynMap.get(t) ?? t.toUpperCase())
        .filter((id): id is string => allIds.includes(id)),
    ),
  );
};