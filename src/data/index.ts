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
      if (context.column === 'resistance_pct') return parseFloat(value);
      if (context.column === 'n_isolates') return parseInt(value, 10);
      return value;
    },
  });

const loadCsv = (dir: string, file: string) =>
  readFile(join(dir, file), "utf8").then(CSV);

let sharedDataPromise: Promise<any> | null = null;

/**
 * Loads the shared data (antibiotics, organisms, sources) and caches the promise.
 * This ensures the data is only read from the file system once during the build process.
 */
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
// Data Processing / ID Resolution (Expert's Code)
// ============================================================================ 

// util: minimal Markdown-Noise rauswerfen (ohne teuren Parser)
const stripMarkdownLight = (s: string) =>
  s
    .replace(/`{1,3}[\s\S]*?`{1,3}/g, " ")        // Inline/Block code
    .replace(/![\[[^\]]*\]\([^)]*\)/g, " ")        // Images
    .replace(/[\[[^\]]+\]\([^)]*\)/g, "$1")      // Links -> Linktext
    .replace(/[*_~#>/]+/g, " ")                   // Emphasis/Headings/Blockquotes
    .replace(/\s+/g, " ")                         // Whitespace normalisieren
    .trim();

// util: sichere Regex-Escapes
const esc = (s: string) => s.replace(/[.*+?^${}()|[\\]/g, "\\$& ");

// util: baue ein robustes Pattern für einen Synonym-String
const makeTokenRegex = (synRaw: string) => {
  const syn = synRaw.trim();
  if (!syn) return null;

  let core = esc(syn)
    .replace(/\\[.]/g, "\\.?")     // "." optional
    .replace(/\\[\\s]+/g, "\\s+");   // beliebiger Whitespace

  const W = "\\p{L}\\p{N}";

  const pattern = `(?<![${W}])${core}(?![${W}])`;
  try {
    return new RegExp(pattern, "iu");
  } catch {
    return new RegExp(`(^|[^${W}])(${core})(?=$|[^${W}])`, "iu");
  }
};

export const mkSynMap = (rows: any[]) =>
  rows.reduce<Map<string, string>>((m, r) => {
    const add = (s: string) => {
      if (!s) return;
      const t = s.trim();
      if (!t) return;
      m.set(t, r.amr_code);
      const noDots = t.replace(/\./g, "");
      if (noDots !== t) m.set(noDots, r.amr_code);
    };
    (r.synonyms_de ?? "").split(";").forEach(add);
    add(r.full_name_de);
    add(r.short_name_de);
    add(r.amr_code);
    return m;
  }, new Map());

// Create a cached, case-insensitive version of the synonym map for manual lookups.
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

// pageText wird leicht bereinigt, dann robustes Matching je Synonym
export const resolveIds = (
  param: string | undefined,
  allIds: string[],
  synMap: Map<string, string>,
  pageText: string,
): string[] => {
  if (param === "auto") {
    const detected = new Set<string>();
    const text = stripMarkdownLight(pageText);

    for (const [syn, id] of synMap.entries()) {
      const rx = makeTokenRegex(syn);
      if (!rx) continue;

      if (rx.test(text)) detected.add(id);
      else {
        const synNoDots = syn.replace(/\./g, "");
        if (synNoDots !== syn) {
          const rx2 = makeTokenRegex(synNoDots);
          if (rx2 && rx2.test(text)) detected.add(id);
        }
      }
    }
    return [...detected];
  }

  if (!param || param === "all") return allIds;

  // Manual path, using a cached lowercase map for performance.
  const lowerCaseSynMap = getLowerCaseSynMap(synMap);
  const requested = param.split(',').map((t) => t.trim().toLowerCase());

  return Array.from(
    new Set(
      requested
        .map((t) => lowerCaseSynMap.get(t) ?? t.toUpperCase())
        .filter((id): id is string => allIds.includes(id)),
    ),
  );
};
