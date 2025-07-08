import { useMemo } from 'react';
import { usePluginData } from '@docusaurus/useGlobalData';
import {
  buildMatrix,
  formatMatrix,
  parseParams,
  resolveIds,
} from '../utils';

export function useResistanceTableData(
  paramString: string,
  pageText: string,
  selectedSource: any,
  showEmpty: boolean,
) {
  const gd: any = usePluginData(
    'docusaurus-plugin-resistogram',
    'example-resistogram',
  );

  const p = useMemo(() => parseParams(paramString), [paramString]);

  const id2Main = useMemo(
    () => new Map<string, string>(Object.entries(gd?.id2MainSyn ?? {})),
    [gd],
  );
  const id2Short = useMemo(
    () => new Map<string, string>(Object.entries(gd?.id2ShortName ?? {})),
    [gd],
  );

  const abxIds = useMemo(
    () =>
      resolveIds(
        p.abx,
        gd?.allAbxIds ?? [],
        gd?.abxSyn2Id ?? {},
        pageText,
      ),
    [p.abx, gd, pageText],
  );
  const orgIds = useMemo(
    () =>
      resolveIds(
        p.org,
        gd?.allOrgIds ?? [],
        gd?.orgSyn2Id ?? {},
        pageText,
      ),
    [p.org, gd, pageText],
  );

  const resistanceData = useMemo(
    () =>
      selectedSource && gd?.resistanceData
        ? gd.resistanceData[selectedSource.file] ?? []
        : [],
    [selectedSource, gd],
  );

  // layout switch
  const { rowIds, colIds, rowsAreAbx } = useMemo(() => {
    const autoLayout =
      p.layout === 'auto' || !p.layout ? 'auto' : p.layout;
    let rIds = abxIds;
    let cIds = orgIds;
    let rAreAbx = true;

    if (autoLayout === 'organisms-rows') {
      rIds = orgIds;
      cIds = abxIds;
      rAreAbx = false;
    } else if (autoLayout === 'auto') {
      if (orgIds.length > 4 && abxIds.length && orgIds.length / abxIds.length > 2) {
        rIds = orgIds;
        cIds = abxIds;
        rAreAbx = false;
      }
    }
    return { rowIds: rIds, colIds: cIds, rowsAreAbx: rAreAbx };
  }, [p.layout, abxIds, orgIds]);

  const matrix = useMemo(
    () => buildMatrix(rowIds, colIds, rowsAreAbx, resistanceData),
    [rowIds, colIds, rowsAreAbx, resistanceData],
  );

  const { emptyRowIds, emptyColIds } = useMemo(() => {
    const emptyRows = rowIds.filter((id) => matrix.get(id)?.size === 0);
    const nonEmptyCols = new Set<string>();
    matrix.forEach((colMap) => colMap.forEach((_v, cId) => nonEmptyCols.add(cId)));
    const emptyCols = colIds.filter((id) => !nonEmptyCols.has(id));
    return { emptyRowIds: emptyRows, emptyColIds: emptyCols };
  }, [matrix, rowIds, colIds]);

  const finalRowIds = showEmpty ? rowIds : rowIds.filter((id) => !emptyRowIds.includes(id));
  const finalColIds = showEmpty ? colIds : colIds.filter((id) => !emptyColIds.includes(id));

  const { data, cols } = useMemo(
    () => formatMatrix(matrix, finalRowIds, finalColIds, id2Main, id2Short),
    [matrix, finalRowIds, finalColIds, id2Main, id2Short],
  );

  return {
    resistanceData,
    data,
    cols,
    rowsAreAbx,
    emptyRowIds,
    emptyColIds,
    sources: gd?.sources ?? [],
    abxIds,
    orgIds,
    p,
    id2Main
  };
}
