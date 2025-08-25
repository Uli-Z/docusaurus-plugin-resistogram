import type { LoadContext, Plugin, Props } from "@docusaurus/types";
import path from "path";
import { join } from "path";
import { ensureDirSync, writeJsonSync, copySync } from "fs-extra";
import { getSharedData, loadResistanceDataForSource } from "./data";

interface Opts {
  id?: string;
  dataDir?: string;
  files?: {
    antibiotics?: string;
    organisms?: string;
    sources?: string;
    abxClasses?: string;
    orgClasses?: string;
    orgGroups?: string;
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
    orgGroups: opts.files?.orgGroups ?? "organism_groups.csv",
  };
  const dataPath = join(siteDir, dataDir);
  const pluginId = opts.id ?? "default";
  const pluginDataDir = join(
    generatedFilesDir,
    "docusaurus-plugin-resistogram",
    pluginId
  );
  ensureDirSync(pluginDataDir);

  return {
    name: "docusaurus-plugin-resistogram",

    getThemePath() {
      return path.resolve(__dirname, "./theme");
    },

    async contentLoaded({ actions }: { actions: any }) {
      const { abx, org, sources, hierarchicalSources, allAbxIds, allOrgIds, orgClasses, orgIdToRank, abxSyn2Id, orgSyn2Id } = await getSharedData(dataPath, files);

      const resistanceDataFileNames = new Map<string, string>();
      const allResistanceData = {}; 

      for (const source of sources) {
        const resistanceData = await loadResistanceDataForSource(source, sources, dataPath);
        
        // Store the raw (uncompressed) data for server-side rendering.
        if (resistanceData.length > 0) {
          allResistanceData[source.id] = resistanceData;
        }

        if (resistanceData.length === 0) continue;

        // Compress data for client-side fetch payloads to reduce file size.
        const headers = Object.keys(resistanceData[0] || {});
        const compressedData = [
          headers,
          ...resistanceData.map((row: any) => headers.map((h) => row[h])),
        ];
        const fileName = `resist-data-${source.id}.json`;
        writeJsonSync(join(pluginDataDir, fileName), compressedData);
        resistanceDataFileNames.set(source.id, fileName);
      }

      // Create and write the shared data file for the client.
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
        allOrgIds,
        orgIdToRank,
        sources,
        hierarchicalSources,
        abxSyn2Id: Object.fromEntries(abxSyn2Id),
        orgSyn2Id: Object.fromEntries(orgSyn2Id),
      };
      writeJsonSync(join(pluginDataDir, sharedDataFileName), sharedData);

      // In dev mode, copy generated files to a static dir to be served.
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) {
        const staticDir = join(siteDir, 'static', 'resistogram-data', pluginId);
        ensureDirSync(staticDir);
        copySync(pluginDataDir, staticDir);
      }

      // Determine the base URL for fetching data on the client.
      const dataUrl = isDev 
        ? join(ctx.baseUrl, 'resistogram-data', pluginId) 
        : join(ctx.baseUrl, 'assets/json');

      // Set all data that the client needs, including the preloaded data for SSR.
      const globalData = {
        sources: hierarchicalSources,
        resistanceDataFileNames: Object.fromEntries(resistanceDataFileNames),
        sharedDataFileName,
        dataUrl,
        ssr: {
          sharedData,
          resistanceData: allResistanceData,
        }
      };
      actions.setGlobalData(globalData);
    },

    async postBuild({ outDir }: Props) {
      const destDir = join(outDir, "assets", "json");
      ensureDirSync(destDir);
      copySync(pluginDataDir, destDir);
    },
  };
}
