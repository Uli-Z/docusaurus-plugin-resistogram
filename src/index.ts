import type { LoadContext, Plugin } from "@docusaurus/types";
import { join } from "path";
import { loadCsv, mkSynMap } from "./data/csv";

interface Opts {
  dataDir?: string;
  files?: {
    antibiotics?: string;
    organisms?: string;
    resistance?: string;
  };
}

export default function pluginResist(
  ctx: LoadContext,
  opts: Opts = {}
): Plugin {
  const { siteDir } = ctx;
  const dataDir = opts.dataDir ?? "data";
  const files = {
    antibiotics: opts.files?.antibiotics ?? "antibiotics.csv",
    organisms: opts.files?.organisms ?? "organisms.csv",
    resistance: opts.files?.resistance ?? "resistance.csv",
  };

  return {
    name: "docusaurus-plugin-resistogram",

    async contentLoaded({ actions }) {
      const [abx, org, res] = await loadCsv(join(siteDir, dataDir), [
        files.antibiotics,
        files.organisms,
        files.resistance,
      ]);

      const abxSyn2Id = mkSynMap(abx);
      const orgSyn2Id = mkSynMap(org);

      const globalData = {
        abxSyn2Id: Object.fromEntries(abxSyn2Id),
        orgSyn2Id: Object.fromEntries(orgSyn2Id),
        id2MainSyn: Object.fromEntries(
          new Map(
            [...abx, ...org].map((r: any) => [
              r.id,
              r.full_name ?? r.synonyms.split("|")[0],
            ])
          )
        ),
        id2ShortName: Object.fromEntries(
          new Map([...abx, ...org].map((r: any) => [r.id, r.short_name]))
        ),
        resistanceData: res,
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