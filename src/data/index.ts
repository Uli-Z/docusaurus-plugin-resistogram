import { readFile } from "fs/promises";
import { join } from "path";
import { parse } from "csv-parse/sync";
import { Source } from "../types";

export { Source };


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
      if (
        ["resistance_pct", "n_isolates"].includes(context.column as string)
      ) {
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
      }
      return value;
    },
  });

const loadCsv = (dir: string, file: string) =>
  readFile(join(dir, file), "utf8").then(CSV).catch(err => {
    console.error(`Error loading CSV file: ${file} in ${dir}`, err);
    return [];
  });


let sharedDataPromise: Promise<any> | null = null;

export function getSharedData(
  dir: string,
  files: {
    antibiotics: string;
    organisms:string;
    sources: string;
  }
) {
  if (!sharedDataPromise) {
    sharedDataPromise = Promise.all([
      loadCsv(dir, files.antibiotics),
      loadCsv(dir, files.organisms),
      loadCsv(dir, files.sources),
    ]).then(([abx, org, rawSources]) => {

      const sources = rawSources.map((s: any) => ({
        ...s,
        url: s.source_url,
      }));

      const abxSyn2Id = mkSynMap(abx);
      const orgSyn2Id = mkSynMap(org);
      const allAbxIds = abx.filter((r: any) => r.class).map((r: any) => r.amr_code);
      const allOrgIds = org.filter((r: any) => r.class_id).map((r: any) => r.amr_code);

      const sourcesById: Map<string, Source & { children: Source[] }> = new Map(sources.map((s: Source) => [s.id, { ...s, children: [] as Source[] }]));
      const hierarchicalSources: Source[] = [];
      for (const source of sourcesById.values()) {
        if (source.parent_id && sourcesById.has(source.parent_id)) {
          const parent = sourcesById.get(source.parent_id)!;
          parent.children.push(source);
        } else {
          hierarchicalSources.push(source);
        }
      }

      return { abx, org, sources, hierarchicalSources, abxSyn2Id, orgSyn2Id, allAbxIds, allOrgIds };
    });
  }
  return sharedDataPromise;
}

// --- Hierarchical Data Loading ---

export const getPathToSource = (sources: Source[], targetId: string): Source[] => {
  const sourcesById = new Map(sources.map(s => [s.id, s]));
  const path: Source[] = [];
  let currentId: string | undefined = targetId;
  while (currentId && sourcesById.has(currentId)) {
    const source: Source = sourcesById.get(currentId)!;
    path.unshift(source);
    currentId = source.parent_id;
  }
  return path;
};

export const loadResistanceDataForSource = async (
  source: Source,
  allSources: Source[],
  dataDir: string
): Promise<any[]> => {
  const path = getPathToSource(allSources, source.id);
  if (path.length === 0) return [];

  const allDataFrames = await Promise.all(
    path.map(s => 
      loadCsv(dataDir, s.source_file).then(rows => 
        rows.map(row => ({ ...row, source_id: s.id }))
      )
    )
  );

  const mergedData = new Map<string, any>();
  for (const df of allDataFrames) {
    for (const row of df) {
      const key = `${row.antibiotic_id}-${row.organism_id}`;
      mergedData.set(key, row);
    }
  }

  return Array.from(mergedData.values());
};


// ============================================================================ 
// Data Processing / ID Resolution
// ============================================================================ 

// util: minimal Markdown-Noise rauswerfen (ohne teuren Parser)
const stripMarkdownLight = (s: string) =>
  s
    .replace(/`{1,3}[\s\S]*?`{1,3}/g, " ")        // Inline/Block code
    .replace(/![[^\]]*\]\([^)]*\)/g, " ")        // Images
    .replace(/[[^\]]+]\[\([^)]*\)/g, "$1")      // Links -> Linktext
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
    .replace(/\По/g, "\\.?")     // "." optional
    .replace(/\\s+/g, "\\s+");   // beliebiger Whitespace

  const W = "\\p{L}\\p{N}";

  const pattern = `(?<![${W}])${core}(?![${W}])`;
  try {
    return new RegExp(pattern, "iu");
  } catch {
    return new RegExp(`(^|[^${W}])(${core})(?=$|[^${W}])`, "iu");
  }
};

export const selectDataSource = (src: string | undefined, sources: Source[]): Source => {
  const getParentCount = (source: Source, allSources: Source[]): number => {
    let count = 0;
    let current = source;
    const sourceMap = new Map(allSources.map(s => [s.id, s]));
    while (current.parent_id && sourceMap.has(current.parent_id)) {
      count++;
      current = sourceMap.get(current.parent_id)!;
    }
    return count;
  };

  const sort = (sourcesToSort: Source[], priority: 'year' | 'parents'): Source[] => {
    return sourcesToSort.sort((a, b) => {
      const parentCountA = getParentCount(a, sources);
      const parentCountB = getParentCount(b, sources);
      const yearA = a.year;
      const yearB = b.year;

      if (priority === 'parents') {
        if (parentCountA !== parentCountB) return parentCountB - parentCountA;
        if (yearA !== yearB) return yearB - yearA;
      } else { // priority === 'year'
        if (yearA !== yearB) return yearB - yearA;
        if (parentCountA !== parentCountB) return parentCountB - parentCountA;
      }

      return sources.indexOf(a) - sources.indexOf(b);
    });
  };

  if (!src) {
    return sort([...sources], 'year')[0];
  }

  const filteredSources = sources.filter(s =>
    s.name_de.toLowerCase().includes(src.toLowerCase()) ||
    s.year.toString().includes(src)
  );

  if (filteredSources.length === 0) {
    return sort([...sources], 'year')[0];
  }

  return sort(filteredSources, 'parents')[0];
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

    // Process all relevant columns for synonyms and names
    add(r.amr_code);
    for (const key in r) {
      if (key.startsWith('synonyms_') || key.startsWith('full_name_') || key.startsWith('short_name_')) {
        (r[key] ?? "").split(";").forEach(add);
      }
    }
    
    return m;
  }, new Map());

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