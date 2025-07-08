import type { LoadContext, Plugin } from "@docusaurus/types";
import { join } from "path";
import { loadData, mkSynMap } from "./data";

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
  const { siteDir } = ctx;
  const dataDir = opts.dataDir ?? "data";
  const files = {
    antibiotics: opts.files?.antibiotics ?? "antibiotics.json",
    organisms: opts.files?.organisms ?? "organisms.json",
    sources: opts.files?.sources ?? "data-src.json",
  };

  return {
    name: "docusaurus-plugin-resistogram",

    async contentLoaded({ actions }) {
      const { abx, org, sources, resistanceData } = await loadData(
        join(siteDir, dataDir),
        files
      );

      const abxSyn2Id = mkSynMap(abx);
      const orgSyn2Id = mkSynMap(org);

      const globalData = {
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
        resistanceData: Object.fromEntries(resistanceData),
        allAbxIds: abx.map((r: any) => r.id),
        allOrgIds: org.map((r: any) => r.id),
      };

      actions.setGlobalData(globalData);
    },

    getThemePath() {
      return "./theme";
    },
  };
}