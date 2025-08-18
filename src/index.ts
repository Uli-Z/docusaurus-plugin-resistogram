import type { LoadContext, Plugin } from "@docusaurus/types";
import { join } from "path";
import { ensureDirSync, writeJsonSync, copySync } from "fs-extra";
import { getSharedData, loadResistanceDataForSource } from "./data";

interface Opts {
  dataDir?: string;
  files?: {
    antibiotics?: string;
    organisms?: string;
    sources?: string;
    abxClasses?: string;
    orgClasses?: string;
  };
}

export default function docusaurusPluginResistogram(
  ctx: LoadContext,
  opts: Opts = {}
): Plugin {
  const { siteDir, generatedFilesDir } = ctx;
  const dataDir = opts.dataDir ?? "data";
  const files = {
    antibiotics: opts.files?.antibiotics ?? "antibiotics.csv",
    organisms: opts.files?.organisms ?? "organisms.csv",
    sources: opts.files?.sources ?? "data_sources.csv",
    abxClasses: opts.files?.abxClasses ?? "antibiotic_classes.csv",
    orgClasses: opts.files?.orgClasses ?? "organism_classes.csv",
  };
  const dataPath = join(siteDir, dataDir);
  const pluginDataDir = join(
    generatedFilesDir,
    "docusaurus-plugin-resistogram"
  );
  ensureDirSync(pluginDataDir);

  return {
    name: "docusaurus-plugin-resistogram",

    async contentLoaded({ actions }) {
      const { abx, org, sources, hierarchicalSources, allAbxIds, allOrgIds, orgClasses, orgIdToRank } = await getSharedData(dataPath, files);

      // 1. Process and write resistance data for each source, using the new hierarchical loader
      const resistanceDataFileNames = new Map<string, string>();
      for (const source of sources) { // Iterate over the flat list to process all sources
        const resistanceData = await loadResistanceDataForSource(source, sources, dataPath);
        if (resistanceData.length === 0) continue; // Skip empty sources

        const headers = Object.keys(resistanceData[0] || {});
        // Compress data into an array of arrays for smaller JSON size
        const compressedData = [
          headers,
          ...resistanceData.map((row: any) => headers.map((h) => row[h])),
        ];
        const fileName = `resist-data-${source.id}.json`; // Use source.id for a stable name
        writeJsonSync(join(pluginDataDir, fileName), compressedData);
        resistanceDataFileNames.set(source.id, fileName);
      }

      // 2. Create and write the shared data file for the client
      const classToAbx = new Map<string, string[]>();
      for (const antibiotic of abx) {
        if (antibiotic.class) {
          if (!classToAbx.has(antibiotic.class)) {
            classToAbx.set(antibiotic.class, []);
          }
          classToAbx.get(antibiotic.class)!.push(antibiotic.amr_code);
        }
      }

      const sharedDataFileName = "shared-resistogram-data.json";
      const sharedData = {
        abx,
        org,
        id2MainSyn: Object.fromEntries(
          new Map([...abx, ...org].map((r: any) => [r.amr_code, { name_de: r.full_name_de, name_en: r.full_name_en }]))
        ),
        id2ShortName: Object.fromEntries(
          new Map([...abx, ...org].map((r: any) => [r.amr_code, { name_de: r.short_name_de, name_en: r.short_name_en }]))
        ),
        classToAbx: Object.fromEntries(classToAbx),
        allAbxIds,
        orgIdToRank,
      };
      writeJsonSync(join(pluginDataDir, sharedDataFileName), sharedData);

      // 3. Set global data, now with hierarchical sources
      const globalData = {
        sources: hierarchicalSources, // Pass the tree structure to the client
        resistanceDataFileNames: Object.fromEntries(resistanceDataFileNames),
        sharedDataFileName,
      };
      actions.setGlobalData(globalData);
    },

    async postBuild({ outDir }) {
      const destDir = join(outDir, "assets", "json");
      ensureDirSync(destDir);
      copySync(pluginDataDir, destDir);
    },

    getThemePath() {
      return "./theme";
    },

    configureWebpack() {
      return {
        mergeStrategy: { "devServer.static": "append" },
        devServer: {
          static: {
            directory: pluginDataDir,
            publicPath: "/assets/json",
          },
        },
      };
    },
  };
}