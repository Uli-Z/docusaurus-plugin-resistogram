var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/data/index.ts
import { readFile } from "fs/promises";
import { join } from "path";
import { parse } from "csv-parse/sync";
var CSV = (txt) => parse(txt, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  bom: true,
  cast: (value, context) => {
    if (context.header) return value;
    if (["resistance_pct", "n_isolates"].includes(context.column)) {
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    }
    return value;
  }
});
var csvCache = /* @__PURE__ */ new Map();
var loadCsv = (dir, file) => {
  const path = join(dir, file);
  if (!csvCache.has(path)) {
    const promise = readFile(path, "utf8").then(CSV).catch((err) => {
      console.error(`Error loading CSV file: ${file} in ${dir}`, err);
      return [];
    });
    csvCache.set(path, promise);
  }
  return csvCache.get(path);
};
var sharedDataPromise = null;
var collectSynonyms = (row) => {
  const synonyms = /* @__PURE__ */ new Set();
  const add = (s) => {
    if (!s) return;
    s.split(/[;,]/).forEach((part) => {
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
    if (key.startsWith("synonyms_") || key.startsWith("full_name_") || key.startsWith("short_name_") || key.startsWith("name_")) {
      add(row[key]);
    }
  }
  return Array.from(synonyms);
};
function getSharedData(dir, files) {
  if (!sharedDataPromise) {
    sharedDataPromise = Promise.all([
      loadCsv(dir, files.antibiotics),
      loadCsv(dir, files.organisms),
      loadCsv(dir, files.sources),
      loadCsv(dir, files.abxClasses),
      loadCsv(dir, files.orgClasses),
      loadCsv(dir, files.orgGroups)
    ]).then(([abx, org, rawSources, abxClasses, orgClasses, orgGroups]) => {
      const sources = rawSources.map((s) => ({
        ...s,
        url: s.source_url
      }));
      const abxSyn2Id = mkSynMap(abx);
      const orgSyn2Id = mkSynMap(org);
      const orgClassesById = new Map(orgClasses.map((c) => [c.id, c]));
      const orgClassChildren = /* @__PURE__ */ new Map();
      for (const c of orgClasses) {
        const parentId = c.parent_id || "";
        if (!orgClassChildren.has(parentId)) {
          orgClassChildren.set(parentId, []);
        }
        orgClassChildren.get(parentId).push(c);
      }
      const classIdToRank = /* @__PURE__ */ new Map();
      const traverse = (parentId, prefix) => {
        const children = orgClassChildren.get(parentId) ?? [];
        children.sort((a, b) => orgClasses.indexOf(a) - orgClasses.indexOf(b));
        children.forEach((child, index) => {
          const rank = prefix ? `${prefix}.${(index + 1).toString().padStart(2, "0")}` : (index + 1).toString().padStart(2, "0");
          classIdToRank.set(child.id, rank);
          traverse(child.id, rank);
        });
      };
      traverse("", "");
      const orgIdToRank = /* @__PURE__ */ new Map();
      for (const organism of org) {
        const rank = classIdToRank.get(organism.class_id) || "99";
        orgIdToRank.set(organism.amr_code, rank);
      }
      const synonymToAllMembers = /* @__PURE__ */ new Map();
      for (const abxClass of abxClasses) {
        const classId = abxClass.id;
        const members = abx.filter((a) => a.class === classId).map((a) => a.amr_code);
        if (members.length > 0) {
          const synonyms = collectSynonyms(abxClass);
          for (const syn of synonyms) {
            if (!synonymToAllMembers.has(syn)) {
              synonymToAllMembers.set(syn, []);
            }
            synonymToAllMembers.get(syn).push(...members);
          }
        }
      }
      for (const [syn, members] of synonymToAllMembers.entries()) {
        const existingIds = abxSyn2Id.has(syn) ? abxSyn2Id.get(syn).split(",") : [];
        const allIds = [.../* @__PURE__ */ new Set([...existingIds, ...members])];
        abxSyn2Id.set(syn, allIds.join(","));
      }
      const classToAllDescendantOrgs = /* @__PURE__ */ new Map();
      const getDescendantOrgs = (classId) => {
        if (classToAllDescendantOrgs.has(classId)) return classToAllDescendantOrgs.get(classId);
        const directOrgs = org.filter((o) => o.class_id === classId).map((o) => o.amr_code);
        const childClasses = orgClassChildren.get(classId) ?? [];
        const descendantOrgs = childClasses.flatMap((child) => getDescendantOrgs(child.id));
        const allOrgs = [.../* @__PURE__ */ new Set([...directOrgs, ...descendantOrgs])];
        classToAllDescendantOrgs.set(classId, allOrgs);
        return allOrgs;
      };
      for (const classId of orgClassesById.keys()) {
        getDescendantOrgs(classId);
      }
      for (const orgClass of orgClasses) {
        const members = classToAllDescendantOrgs.get(orgClass.id);
        if (members && members.length > 0) {
          const synonyms = collectSynonyms(orgClass);
          for (const syn of synonyms) {
            orgSyn2Id.set(syn, members.join(","));
          }
        }
      }
      const groupIdToOrgIds = /* @__PURE__ */ new Map();
      for (const organism of org) {
        const groupIdsStr = organism.groups;
        if (groupIdsStr) {
          const groupIds = groupIdsStr.split(";").map((id) => id.trim()).filter(Boolean);
          for (const groupId of groupIds) {
            if (!groupIdToOrgIds.has(groupId)) {
              groupIdToOrgIds.set(groupId, []);
            }
            groupIdToOrgIds.get(groupId).push(organism.amr_code);
          }
        }
      }
      for (const group of orgGroups) {
        const members = groupIdToOrgIds.get(group.id);
        if (members && members.length > 0) {
          const synonyms = collectSynonyms(group);
          for (const syn of synonyms) {
            const existingIds = orgSyn2Id.has(syn) ? orgSyn2Id.get(syn).split(",") : [];
            const allIds = [.../* @__PURE__ */ new Set([...existingIds, ...members])];
            orgSyn2Id.set(syn, allIds.join(","));
          }
        }
      }
      const allAbxIds = abx.filter((r) => r.class).map((r) => r.amr_code);
      const allOrgIds = org.filter((r) => r.class_id).map((r) => r.amr_code);
      const sourcesById = new Map(
        sources.map((s) => [s.id, { ...s, children: [] }])
      );
      const hierarchicalSources = [];
      for (const source of sourcesById.values()) {
        if (source.parent_id && sourcesById.has(source.parent_id)) {
          const parent = sourcesById.get(source.parent_id);
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
        orgIdToRank: Object.fromEntries(orgIdToRank)
      };
    });
  }
  return sharedDataPromise;
}
var getPathToSource = (sources, targetId) => {
  const sourcesById = new Map(sources.map((s) => [s.id, s]));
  const path = [];
  let currentId = targetId;
  while (currentId && sourcesById.has(currentId)) {
    const source = sourcesById.get(currentId);
    path.unshift(source);
    currentId = source.parent_id;
  }
  return path;
};
var loadResistanceDataForSource = async (source, allSources, dataDir) => {
  const path = getPathToSource(allSources, source.id);
  if (path.length === 0) return [];
  const csvDataFrames = await Promise.all(
    path.map((s) => loadCsv(dataDir, s.source_file))
  );
  const allDataFrames = csvDataFrames.map(
    (rows, idx) => rows.map((row) => ({ ...row, source_id: path[idx].id }))
  );
  const mergedData = /* @__PURE__ */ new Map();
  for (const df of allDataFrames) {
    for (const row of df) {
      const key = `${row.antibiotic_id}-${row.organism_id}`;
      mergedData.set(key, row);
    }
  }
  return Array.from(mergedData.values());
};
var stripMarkdownLight = (s) => s.replace(/`{1,3}[\s\S]*?`{1,3}/g, " ").replace(/!\\\[[^\\]*\]\([^)]*\)/g, " ").replace(/\\[^\\]+\]\([^)]*\)/g, "$1").replace(/[*_~#>\/.,]+/g, " ").replace(/\s+/g, " ").trim();
var makeTokenRegex = (synRaw) => {
  const syn = synRaw.trim();
  if (!syn) return null;
  let core = syn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\./g, "\\.?").replace(/\s+/g, "\\s+");
  const W = "\\p{L}\\p{N}";
  const pattern = `(?<![${W}])${core}(?![${W}])`;
  try {
    return new RegExp(pattern, "iu");
  } catch {
    return new RegExp(`(^|[^${W}])(${core})(?=$|[^${W}])`, "iu");
  }
};
var selectDataSource = (src, sources) => {
  const getParentCount = (source, allSources) => {
    let count = 0;
    let current = source;
    const sourceMap = new Map(allSources.map((s) => [s.id, s]));
    while (current.parent_id && sourceMap.has(current.parent_id)) {
      count++;
      current = sourceMap.get(current.parent_id);
    }
    return count;
  };
  const sort = (sourcesToSort, priority) => {
    return sourcesToSort.sort((a, b) => {
      const parentCountA = getParentCount(a, sources);
      const parentCountB = getParentCount(b, sources);
      const yearA = a.year;
      const yearB = b.year;
      if (priority === "parents") {
        if (parentCountA !== parentCountB) return parentCountB - parentCountA;
        if (yearA !== yearB) return yearB - yearA;
      } else {
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
    (s) => s.id.toLowerCase().includes(src.toLowerCase()) || s.name_de.toLowerCase().includes(src.toLowerCase()) || s.year.toString().includes(src)
  );
  if (filteredSources.length === 0) {
    return sort([...sources], "year")[0];
  }
  return sort(filteredSources, "parents")[0];
};
var mkSynMap = (rows) => rows.reduce((m, r) => {
  const id = r.amr_code || r.id;
  if (!id) return m;
  const synonyms = collectSynonyms(r);
  for (const syn of synonyms) {
    m.set(syn, id);
  }
  return m;
}, /* @__PURE__ */ new Map());
var getLowerCaseSynMap = /* @__PURE__ */ (() => {
  let cache = null;
  let originalMap = null;
  return (synMap) => {
    if (cache && originalMap === synMap) {
      return cache;
    }
    const lowerCaseMap = /* @__PURE__ */ new Map();
    synMap.forEach((value, key) => {
      lowerCaseMap.set(key.toLowerCase(), value);
    });
    cache = lowerCaseMap;
    originalMap = synMap;
    return lowerCaseMap;
  };
})();
var resolveIds = (param, allIds, synMap, pageText) => {
  if (!param) return { resolved: [], unresolved: [] };
  const resolved = /* @__PURE__ */ new Set();
  const requestedTokens = param.split(",").map((t) => t.trim()).filter(Boolean);
  const lowerCaseSynMap = getLowerCaseSynMap(synMap);
  for (const token of requestedTokens) {
    if (token === "auto") {
      const text = stripMarkdownLight(pageText);
      for (const [syn, idOrIds] of synMap.entries()) {
        const strippedSyn = stripMarkdownLight(syn);
        const rx = makeTokenRegex(strippedSyn);
        if (!rx) continue;
        if (rx.test(text)) {
          idOrIds.split(",").forEach((id) => resolved.add(id));
        } else {
          const synNoDots = syn.replace(/\./g, "");
          if (synNoDots !== syn) {
            const strippedSynNoDots = stripMarkdownLight(synNoDots);
            const rx2 = makeTokenRegex(strippedSynNoDots);
            if (rx2 && rx2.test(text)) {
              idOrIds.split(",").forEach((id) => resolved.add(id));
            }
          }
        }
      }
    } else if (token === "all") {
      allIds.forEach((id) => resolved.add(id));
    } else {
      const lowerToken = token.toLowerCase();
      const idOrIds = lowerCaseSynMap.get(lowerToken) ?? token.toUpperCase();
      idOrIds.split(",").forEach((id) => {
        if (allIds.includes(id)) {
          resolved.add(id);
        }
      });
    }
  }
  if (resolved.size === 0) {
    const unresolved2 = requestedTokens.filter((t) => t !== "all" && t !== "auto");
    if (unresolved2.length === 0 && requestedTokens.includes("auto")) {
      unresolved2.push("auto");
    }
    return { resolved: [], unresolved: unresolved2 };
  }
  const finalResolved = Array.from(resolved);
  const unresolved = requestedTokens.filter((token) => {
    if (token === "auto" || token === "all") return false;
    const lowerToken = token.toLowerCase();
    const idOrIds = lowerCaseSynMap.get(lowerToken) ?? token.toUpperCase();
    return !idOrIds.split(",").some((id) => finalResolved.includes(id));
  });
  return { resolved: finalResolved, unresolved };
};

export {
  __require,
  __commonJS,
  __toESM,
  getSharedData,
  loadResistanceDataForSource,
  selectDataSource,
  resolveIds
};
