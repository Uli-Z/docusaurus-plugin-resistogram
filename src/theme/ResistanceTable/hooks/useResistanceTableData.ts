import { useMemo, useState, useEffect } from 'react';
import { usePluginData } from '@docusaurus/useGlobalData';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {
  buildMatrix,
  formatMatrix,
  groupAndSortAntibiotics,
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

async function fetchJson(path: string) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Network response was not ok: ${response.statusText}`);
  }
  return response.json();
}

async function fetchResistanceData(path: string) {
  const compressedData = await fetchJson(path);
  return decompressData(compressedData);
}

export function useResistanceTableData(
  abxIds: string[],
  orgIds: string[],
  layout: string | undefined,
  selectedSource: Source | null,
  showEmpty: boolean,
) {
  const pluginData: any = usePluginData(
    'docusaurus-plugin-resistogram',
    'example-resistogram',
  );

  const [sharedData, setSharedData] = useState<any | null>(null);
  const [resistanceData, setResistanceData] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const sharedDataUrl = useBaseUrl(pluginData.sharedDataFileName ? `/assets/json/${pluginData.sharedDataFileName}` : null);
  const resistanceFileName = selectedSource ? pluginData.resistanceDataFileNames?.[selectedSource.id] : null;
  const resistanceDataUrl = useBaseUrl(resistanceFileName ? `/assets/json/${resistanceFileName}` : null);

  useEffect(() => {
    async function loadShared() {
      console.log('[useResistanceTableData] Loading shared data...');
      if (!sharedDataUrl) {
        setError(new Error("Plugin data not found."));
        setIsLoading(false);
        return;
      }
      try {
        // Don't set loading to true here, it's set initially
        const data = await fetchJson(sharedDataUrl);
        setSharedData(data);
        console.log('[useResistanceTableData] Shared data loaded.');
      } catch (e) {
        setError(e);
        setIsLoading(false); // Set loading to false on error
      }
    }
    loadShared();
  }, [sharedDataUrl]);

  useEffect(() => {
    async function loadResistance() {
      if (!sharedData) return; // Wait for shared data to be loaded first
      console.log('[useResistanceTableData] Loading resistance data for source:', selectedSource?.id);

      if (!resistanceDataUrl || !selectedSource) {
        setResistanceData(null);
        setIsLoading(false);
        console.log('[useResistanceTableData] No source selected or no data URL. Loading finished.');
        return;
      }

      try {
        setIsLoading(true); // Set loading to true before fetching this specific source
        const data = await fetchResistanceData(resistanceDataUrl);
        setResistanceData(data);
        console.log('[useResistanceTableData] Resistance data loaded.');
      } catch (e) {
        setError(e);
      } finally {
        setIsLoading(false); // This is the final loading step
        console.log('[useResistanceTableData] Final loading state set to false.');
      }
    }
    loadResistance();
  }, [resistanceDataUrl, selectedSource, sharedData]);

  const {
    id2MainSyn: id2Main,
    id2ShortName: id2Short,
    allAbxIds,
    classToAbx: classToAbxObj,
  } = sharedData || {};

  const classToAbx = useMemo(
    () => new Map<string, string[]>(Object.entries(classToAbxObj ?? {})),
    [classToAbxObj],
  );

  const sortedAbxIds = useMemo(
    () => groupAndSortAntibiotics(abxIds, allAbxIds ?? [], classToAbx),
    [abxIds, allAbxIds, classToAbx],
  );

  const { rowIds, colIds, rowsAreAbx } = useMemo(() => {
    let rIds: string[] = sortedAbxIds;
    let cIds: string[] = orgIds;
    let rAreAbx = true;

    if (layout === 'organisms-rows') {
      rIds = orgIds;
      cIds = sortedAbxIds;
      rAreAbx = false;
    } else if (layout === 'auto') {
      if (orgIds.length > 4 && abxIds.length && orgIds.length / abxIds.length > 2) {
        rIds = orgIds;
        cIds = sortedAbxIds;
        rAreAbx = false;
      }
    }
    return { rowIds: rIds, colIds: cIds, rowsAreAbx: rAreAbx };
  }, [layout, sortedAbxIds, orgIds, abxIds.length]);

  const matrix = useMemo(
    () => buildMatrix(rowIds, colIds, rowsAreAbx, resistanceData ?? []),
    [rowIds, colIds, rowsAreAbx, resistanceData],
  );

  const { emptyRowIds, emptyColIds } = useMemo(() => {
    const emptyRows = new Set(rowIds.filter((id) => (matrix.get(id)?.size ?? 0) === 0));
    const nonEmptyCols = new Set<string>();
    matrix.forEach((colMap) => colMap.forEach((_v, cId) => nonEmptyCols.add(cId)));
    const emptyCols = new Set(colIds.filter((id) => !nonEmptyCols.has(id)));
    return { emptyRowIds: emptyRows, emptyColIds: emptyCols };
  }, [matrix, rowIds, colIds]);

  const finalRowIds = useMemo(() => showEmpty ? rowIds : rowIds.filter((id) => !emptyRowIds.has(id)), [showEmpty, rowIds, emptyRowIds]);
  const finalColIds = useMemo(() => showEmpty ? colIds : colIds.filter((id) => !emptyColIds.has(id)), [showEmpty, colIds, emptyColIds]);

  const { data, cols } = useMemo(
    () => formatMatrix(matrix, finalRowIds, finalColIds, new Map(Object.entries(id2Main ?? {})), new Map(Object.entries(id2Short ?? {}))),
    [matrix, finalRowIds, finalColIds, id2Main, id2Short],
  );

  return {
    isLoading,
    error,
    data,
    cols,
    rowsAreAbx,
    emptyRowIds: Array.from(emptyRowIds),
    emptyColIds: Array.from(emptyColIds),
    sources: pluginData?.sources ?? [],
  };
}
