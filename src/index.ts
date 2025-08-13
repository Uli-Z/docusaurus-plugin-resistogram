import type { LoadContext, Plugin } from "@docusaurus/types";
import { join } from "path";
import { ensureDirSync, writeJsonSync, copySync } from "fs-extra";
import { getSharedData, loadResistanceDataForSource, mkSynMap } from "./data";

interface Opts {
  dataDir?: string;
  files?: {
    antibiotics?: string;
    organisms?: string;
    sources?: string;
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
      // Use the new cached data loader
      const { abx, org, sources, allAbxIds, allOrgIds } = await getSharedData(dataPath, files);

      // 1. Process and write resistance data for each source
      const resistanceDataFileNames = new Map<string, string>();
      for (const source of sources) {
        const resistanceData = await loadResistanceDataForSource(source, dataPath);
        const headers = Object.keys(resistanceData[0] || {});
        // Compress data into an array of arrays for smaller JSON size
        const compressedData = [
          headers,
          ...resistanceData.map((row: any) => headers.map((h) => row[h])),
        ];
        const fileName = `resist-data-${source.source_file}.json`;
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
        // We no longer need to send all synonyms to the client, only the necessary mappings
        id2MainSyn: Object.fromEntries(
          new Map([...abx, ...org].map((r: any) => [r.amr_code, r.full_name_de]))
        ),
        id2ShortName: Object.fromEntries(
          new Map([...abx, ...org].map((r: any) => [r.amr_code, r.short_name_de]))
        ),
        classToAbx: Object.fromEntries(classToAbx),
        allAbxIds, // Still needed for sorting/grouping on the client
      };
      writeJsonSync(join(pluginDataDir, sharedDataFileName), sharedData);

      // 3. Set global data for the Docusaurus application
      const globalData = {
        sources,
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
