import { useMemo, useState, useEffect } from 'react';
import { usePluginData } from '@docusaurus/useGlobalData';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {
  buildMatrix,
  formatMatrix,
  groupAndSortAntibiotics,
  parseParams,
  resolveIds,
} from '../utils';
import { Source } from '../../../types';

function decompressData(data: any[][]): any[] {
  if (!data || data.length < 2) {
    return [];
  }
  const [headers, ...rows] = data;
  return rows.map((row) => {
    const obj: { [key: string]: any } = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
}

async function fetchResistanceData(path: string) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Network response was not ok: ${response.statusText}`);
  }
  const compressedData = await response.json();
  return decompressData(compressedData);
}

export function useResistanceTableData(
  paramString: string,
  pageText: string,
  selectedSource: Source | null,
  showEmpty: boolean,
) {
  const gd: any = usePluginData(
    'docusaurus-plugin-resistogram',
    'example-resistogram',
  );

  const [resistanceData, setResistanceData] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const p = useMemo(() => parseParams(paramString), [paramString]);

  const fileName = selectedSource ? gd.resistanceDataFileNames?.[selectedSource.file] : null;
  const dataUrl = useBaseUrl(fileName ? `/assets/json/${fileName}` : null);

  useEffect(() => {
    if (!dataUrl || !selectedSource || !fileName) {
      if (!selectedSource) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    fetchResistanceData(dataUrl)
      .then(data => {
        setResistanceData(data);
      })
      .catch(err => {
        setError(err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [dataUrl, selectedSource]);

  const id2Main = useMemo(
    () => new Map<string, string>(Object.entries(gd?.id2MainSyn ?? {})),
    [gd],
  );
  const id2Short = useMemo(
    () => new Map<string, string>(Object.entries(gd?.id2ShortName ?? {})),
    [gd],
  );

  const { allAbxIds, classToAbx: classToAbxObj } = gd;

  const classToAbx = useMemo(
    () => new Map<string, string[]>(Object.entries(classToAbxObj ?? {})),
    [classToAbxObj],
  );

  const abxIds = useMemo(() => {
    const initialIds = resolveIds(
      p.abx,
      gd?.allAbxIds ?? [],
      gd?.abxSyn2Id ?? {},
      pageText,
    );

    if (p.abx !== 'auto') return initialIds;

    const expanded = new Set<string>();
    for (const id of initialIds) {
      if (classToAbx.has(id)) {
        classToAbx.get(id)!.forEach(memberId => expanded.add(memberId));
      } else {
        expanded.add(id);
      }
    }
    return Array.from(expanded);
  }, [p.abx, gd, pageText, classToAbx]);

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

  const sortedAbxIds = useMemo(
    () => groupAndSortAntibiotics(abxIds, allAbxIds, classToAbx),
    [abxIds, allAbxIds, classToAbx],
  );

  // layout switch
  const { rowIds, colIds, rowsAreAbx } = useMemo(() => {
    const autoLayout =
      p.layout === 'auto' || !p.layout ? 'auto' : p.layout;
    let rIds: string[] = sortedAbxIds;
    let cIds: string[] = orgIds;
    let rAreAbx = true;

    if (autoLayout === 'organisms-rows') {
      rIds = orgIds;
      cIds = sortedAbxIds;
      rAreAbx = false;
    } else if (autoLayout === 'auto') {
      if (orgIds.length > 4 && abxIds.length && orgIds.length / abxIds.length > 2) {
        rIds = orgIds;
        cIds = sortedAbxIds;
        rAreAbx = false;
      }
    }
    return { rowIds: rIds, colIds: cIds, rowsAreAbx: rAreAbx };
  }, [p.layout, sortedAbxIds, orgIds, abxIds]);

  const matrix = useMemo(
    () => buildMatrix(rowIds, colIds, rowsAreAbx, resistanceData ?? []),
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
    isLoading,
    error,
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
