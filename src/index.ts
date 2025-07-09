import type { LoadContext, Plugin } from "@docusaurus/types";
import { join } from "path";
import { ensureDirSync, writeJsonSync } from "fs-extra";
import {
  loadSharedData,
  loadResistanceDataForSource,
  mkSynMap,
} from "./data";

interface Opts {
  dataDir?: string;
  files?: {
    antibiotics?: string;
    organisms?: string;
    sources?: string;
  };
}

export default function pluginResist(
  ctx: LoadContext,
  opts: Opts = {}
): Plugin {
  const { siteDir, generatedFilesDir } = ctx;
  const dataDir = opts.dataDir ?? "data";
  const files = {
    antibiotics: opts.files?.antibiotics ?? "antibiotics.json",
    organisms: opts.files?.organisms ?? "organisms.json",
    sources: opts.files?.sources ?? "data-src.json",
  };
  const dataPath = join(siteDir, dataDir);
  const pluginDataDir = join(generatedFilesDir, "docusaurus-plugin-resistogram");
  ensureDirSync(pluginDataDir);

  return {
    name: "docusaurus-plugin-resistogram",

    async contentLoaded({ actions }) {
      const { abxClasses, abxItems, org, sources } = await loadSharedData(
        dataPath,
        files
      );

      const resistanceDataFileNames = new Map<string, string>();
      for (const source of sources) {
        const resistanceData = await loadResistanceDataForSource(
          source,
          dataPath
        );

        const headers = Object.keys(resistanceData[0] || {});
        const compressedData = [
          headers,
          ...resistanceData.map((row) => headers.map((h) => row[h])),
        ];

        const fileName = `resist-data-${source.file}.json`;
        writeJsonSync(join(pluginDataDir, fileName), compressedData);
        resistanceDataFileNames.set(source.file, fileName);
      }

      const abx = [...abxClasses, ...abxItems];
      const abxSyn2Id = mkSynMap(abx);
      const orgSyn2Id = mkSynMap(org);

      const classToAbx = new Map<string, string[]>();
      for (const abx of abxItems) {
        if (abx.class) {
          if (!classToAbx.has(abx.class)) classToAbx.set(abx.class, []);
          classToAbx.get(abx.class)!.push(abx.id);
        }
      }

      const globalData = {
        abxClasses,
        abxItems,
        classToAbx: Object.fromEntries(classToAbx),
        abxSyn2Id: Object.fromEntries(abxSyn2Id),
        orgSyn2Id: Object.fromEntries(orgSyn2Id),
        id2MainSyn: Object.fromEntries(
          new Map(
            [...abx, ...org].map((r: any) => [
              r.id,
              r.full_name ?? r.name ?? r.synonyms[0],
            ])
          )
        ),
        id2ShortName: Object.fromEntries(
          new Map([...abx, ...org].map((r: any) => [r.id, r.short_name]))
        ),
        sources,
        resistanceDataFileNames: Object.fromEntries(resistanceDataFileNames),
        allAbxIds: abx.map((r: any) => r.id),
        allOrgIds: org.map((r: any) => r.id),
      };

      actions.setGlobalData(globalData);
    },

    getThemePath() {
      return "./theme";
    },

    configureWebpack() {
      return {
        devServer: {
          static: {
            directory: pluginDataDir,
            publicPath: '/assets/json',
          },
        },
      };
    },
  };
}