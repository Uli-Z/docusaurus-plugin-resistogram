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
    if (["resistance_pct", "n_isolates"].includes(context.column as string)) {
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    }
    return value;
  },
});

const csvCache = new Map<string, Promise<any[]>>();

const loadCsv = (dir: string, file: string) => {
  const path = join(dir, file);
  if (!csvCache.has(path)) {
    const promise = readFile(path, "utf8")
    .then(CSV)
    .catch((err) => {
      console.error(`Error loading CSV file: ${file} in ${dir}`, err);
      return [];
    });
    csvCache.set(path, promise);
  }
  return csvCache.get(path)!;
};

let sharedDataPromise: Promise<any> | null = null;

const collectSynonyms = (row: any): string[] => {
  const synonyms = new Set<string>();
  const add = (s: string | undefined) => {
    if (!s) return;
    s.split(/[;,]/).forEach(part => {
      const trimmed = part.trim();
      if (trimmed) {
        synonyms.add(trimmed);
        const noDots = trimmed.replace(/\./g, "");
        if (noDots !== trimmed) synonyms.add(noDots);
      }
    });
  };

  add(row.amr_code || row.id);
  for (const key in row) {
    if (
      key.startsWith("synonyms_") ||
      key.startsWith("full_name_") ||
      key.startsWith("short_name_") ||
      key.startsWith("name_") 
    ) {
      add(row[key]);
    }
  }
  return Array.from(synonyms);
};

export function getSharedData(
  dir: string,
  files: {
    antibiotics: string;
    organisms: string;
    sources: string;
    abxClasses: string;
    orgClasses: string;
  },
) {
  if (!sharedDataPromise) {
    sharedDataPromise = Promise.all([
      loadCsv(dir, files.antibiotics),
      loadCsv(dir, files.organisms),
      loadCsv(dir, files.sources),
      loadCsv(dir, files.abxClasses),
      loadCsv(dir, files.orgClasses),
    ]).then(([abx, org, rawSources, abxClasses, orgClasses]) => {
      const sources = rawSources.map((s: any) => ({
        ...s,
        url: s.source_url,
      }));

      const abxSyn2Id = mkSynMap(abx);
      const orgSyn2Id = mkSynMap(org);

      // --- Organism Class Hierarchy and Rank Calculation ---
      const orgClassesById = new Map(orgClasses.map((c: any) => [c.id, c]));
      const orgClassChildren = new Map<string, any[]>();
      for (const c of orgClasses) {
        const parentId = c.parent_id || ''; // Treat empty/undefined as root
        if (!orgClassChildren.has(parentId)) {
          orgClassChildren.set(parentId, []);
        }
        orgClassChildren.get(parentId)!.push(c);
      }

      const classIdToRank = new Map<string, string>();
      const traverse = (parentId: string, prefix: string) => {
        const children = orgClassChildren.get(parentId) ?? [];
        children.sort((a, b) => orgClasses.indexOf(a) - orgClasses.indexOf(b)); // Stable sort

        children.forEach((child, index) => {
          const rank = prefix ? `${prefix}.${(index + 1).toString().padStart(2, '0')}` : (index + 1).toString().padStart(2, '0');
          classIdToRank.set(child.id, rank);
          traverse(child.id, rank);
        });
      };
      traverse('', ""); // Start traversal from the root

      const orgIdToRank = new Map<string, string>();
      for (const organism of org) {
        const rank = classIdToRank.get(organism.class_id) || "99";
        orgIdToRank.set(organism.amr_code, rank);
      }
      // --- End Organism Class Hierarchy ---

      // --- Class Synonym Integration ---
      const synonymToAllMembers = new Map<string, string[]>();

      for (const abxClass of abxClasses) {
        const classId = abxClass.id;
        const members = abx.filter((a: any) => a.class === classId).map((a: any) => a.amr_code);
        
        if (members.length > 0) {
          const synonyms = collectSynonyms(abxClass);
          for (const syn of synonyms) {
            if (!synonymToAllMembers.has(syn)) {
              synonymToAllMembers.set(syn, []);
            }
            synonymToAllMembers.get(syn)!.push(...members);
          }
        }
      }

      for (const [syn, members] of synonymToAllMembers.entries()) {
        abxSyn2Id.set(syn, [...new Set(members)].join(','));
      }
      // --- End Class Synonym Integration ---

      // --- Organism Class Synonym Integration (Hierarchical) ---
      const classToAllDescendantOrgs = new Map<string, string[]>();
      const getDescendantOrgs = (classId: string): string[] => {
        if (classToAllDescendantOrgs.has(classId)) return classToAllDescendantOrgs.get(classId)!;

        const directOrgs = org.filter((o: any) => o.class_id === classId).map((o: any) => o.amr_code);
        const childClasses = orgClassChildren.get(classId) ?? [];
        const descendantOrgs = childClasses.flatMap(child => getDescendantOrgs(child.id));
        
        const allOrgs = [...new Set([...directOrgs, ...descendantOrgs])];
        classToAllDescendantOrgs.set(classId, allOrgs);
        return allOrgs;
      };

      for (const classId of orgClassesById.keys()) {
        getDescendantOrgs(classId); // Pre-populate for all classes
      }

      for (const orgClass of orgClasses) {
        const members = classToAllDescendantOrgs.get(orgClass.id);
        if (members && members.length > 0) {
          const synonyms = collectSynonyms(orgClass);
          for (const syn of synonyms) {
            orgSyn2Id.set(syn, members.join(','));
          }
        }
      }
      // --- End Organism Class Synonym Integration ---

      const allAbxIds = abx
        .filter((r: any) => r.class)
        .map((r: any) => r.amr_code);
      const allOrgIds = org
        .filter((r: any) => r.class_id)
        .map((r: any) => r.amr_code);

      const sourcesById: Map<string, Source & { children: Source[] }> = new Map(
        sources.map((s: Source) => [s.id, { ...s, children: [] as Source[] }]),
      );
      const hierarchicalSources: Source[] = [];
      for (const source of sourcesById.values()) {
        if (source.parent_id && sourcesById.has(source.parent_id)) {
          const parent = sourcesById.get(source.parent_id)!;
          parent.children.push(source);
        } else {
          hierarchicalSources.push(source);
        }
      }

      return {
        abx,
        org,
        sources,
        hierarchicalSources,
        abxSyn2Id,
        orgSyn2Id,
        allAbxIds,
        allOrgIds,
        orgClasses,
        orgIdToRank: Object.fromEntries(orgIdToRank),
      };
    });
  }
  return sharedDataPromise;
}

// --- Hierarchical Data Loading ---

export const getPathToSource = (
  sources: Source[],
  targetId: string,
): Source[] => {
  const sourcesById = new Map(sources.map((s) => [s.id, s]));
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
  dataDir: string,
): Promise<any[]> => {
  const path = getPathToSource(allSources, source.id);
  if (path.length === 0) return [];

  const csvDataFrames = await Promise.all(
    path.map((s) => loadCsv(dataDir, s.source_file)),
  );
  const allDataFrames = csvDataFrames.map((rows, idx) =>
    rows.map((row) => ({ ...row, source_id: path[idx].id })),
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
.replace(/`{1,3}[\s\S]*?`{1,3}/g, " ") // Inline/Block code
.replace(/!\\\[[^\\]*\]\([^)]*\)/g, " ") // Images
.replace(/\\[^\\]+\]\([^)]*\)/g, "$1") // Links -> Linktext
.replace(/[*_~#>\/.,]+/g, " ") // Emphasis/Headings/Blockquotes/Punctuation
.replace(/\s+/g, " ") // Whitespace normalisieren
.trim();

// util: sichere Regex-Escapes (korrekt ohne zusätzliche Leerzeichen)
const esc = (
  s: string
) =>
s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&" );

// util: baue ein robustes Pattern für einen Synonym-String
const makeTokenRegex = (synRaw: string): RegExp | null => {
  const syn = synRaw.trim();
  if (!syn) return null;

  // Escape special characters, make dots optional and collapse whitespace.
  let core = syn
  .replace(/[.*+?^${}()|[\]\\]/g, "\\$&" )
  .replace(/\\\./g, "\\.?")
  .replace(/\s+/g, "\\s+");

  const W = "\\p{L}\\p{N}";
  const pattern = `(?<![${W}])${core}(?![${W}])`;
  try {
    return new RegExp(pattern, "iu");
  } catch {
    // Fallback for environments without lookbehind support.
    return new RegExp(`(^|[^${W}])(${core})(?=$|[^${W}])`, "iu");
  }
};

export const selectDataSource = (
  src: string | undefined,
  sources: Source[],
): Source => {
  const getParentCount = (source: Source, allSources: Source[]): number => {
    let count = 0;
    let current = source;
    const sourceMap = new Map(allSources.map((s) => [s.id, s]));
    while (current.parent_id && sourceMap.has(current.parent_id)) {
      count++;
      current = sourceMap.get(current.parent_id)!;
    }
    return count;
  };

  const sort = (
    sourcesToSort: Source[],
    priority: "year" | "parents",
  ): Source[] => {
    return sourcesToSort.sort((a, b) => {
      const parentCountA = getParentCount(a, sources);
      const parentCountB = getParentCount(b, sources);
      const yearA = a.year;
      const yearB = b.year;

      if (priority === "parents") {
        if (parentCountA !== parentCountB) return parentCountB - parentCountA;
        if (yearA !== yearB) return yearB - yearA;
      } else {
        // priority === 'year'
        if (yearA !== yearB) return yearB - yearA;
        if (parentCountA !== parentCountB) return parentCountB - parentCountA;
      }

      return sources.indexOf(a) - sources.indexOf(b);
    });
  };

  if (!src) {
    return sort([...sources], "year")[0];
  }

  const filteredSources = sources.filter(
    (s) =>
    s.id.toLowerCase().includes(src.toLowerCase()) ||
    s.name_de.toLowerCase().includes(src.toLowerCase()) ||
    s.year.toString().includes(src),
  );

  if (filteredSources.length === 0) {
    return sort([...sources], "year")[0];
  }

  return sort(filteredSources, "parents")[0];
};

export const mkSynMap = (rows: any[]) =>
  rows.reduce<Map<string, string>>((m, r) => {
    const id = r.amr_code || r.id;
    if (!id) return m;
    
    const synonyms = collectSynonyms(r);
    for (const syn of synonyms) {
      m.set(syn, id);
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
): { resolved: string[]; unresolved: string[] } => {
  if (!param) return { resolved: [], unresolved: [] };

  const resolved = new Set<string>();
  const requestedTokens = param.split(",").map((t) => t.trim()).filter(Boolean);
  const lowerCaseSynMap = getLowerCaseSynMap(synMap);

  // Step 1: Process all tokens and populate the resolved set
  for (const token of requestedTokens) {
    if (token === 'auto') {
      const text = stripMarkdownLight(pageText);
      for (const [syn, idOrIds] of synMap.entries()) {
        const strippedSyn = stripMarkdownLight(syn);
        const rx = makeTokenRegex(strippedSyn);
        if (!rx) continue;
        if (rx.test(text)) {
          idOrIds.split(',').forEach(id => resolved.add(id));
        } else {
          const synNoDots = syn.replace(/\./g, "");
          if (synNoDots !== syn) {
            const strippedSynNoDots = stripMarkdownLight(synNoDots);
            const rx2 = makeTokenRegex(strippedSynNoDots);
            if (rx2 && rx2.test(text)) {
              idOrIds.split(',').forEach(id => resolved.add(id));
            }
          }
        }
      }
    } else if (token === 'all') {
      allIds.forEach(id => resolved.add(id));
    } else {
      // Manual token
      const lowerToken = token.toLowerCase();
      const idOrIds = lowerCaseSynMap.get(lowerToken) ?? token.toUpperCase();
      idOrIds.split(',').forEach(id => {
        if (allIds.includes(id)) {
          resolved.add(id);
        }
      });
    }
  }

  // Step 2: Final check. If resolution is empty, the entire parameter is invalid.
  if (resolved.size === 0) {
    const unresolved = requestedTokens.filter(t => t !== 'all' && t !== 'auto');
    // If only 'auto' was provided and it failed, make sure to report 'auto' as unresolved.
    if (unresolved.length === 0 && requestedTokens.includes('auto')) {
      unresolved.push('auto');
    }
    return { resolved: [], unresolved };
  }

  // Step 3: If resolution is successful, find any specific tokens that didn't resolve.
  const finalResolved = Array.from(resolved);
  const unresolved = requestedTokens.filter(token => {
    if (token === 'auto' || token === 'all') return false;
    
    const lowerToken = token.toLowerCase();
    const idOrIds = lowerCaseSynMap.get(lowerToken) ?? token.toUpperCase();
    
    // A token is unresolved if NONE of its potential IDs made it into the final resolved list.
    return !idOrIds.split(',').some(id => finalResolved.includes(id));
  });

  return { resolved: finalResolved, unresolved };
};