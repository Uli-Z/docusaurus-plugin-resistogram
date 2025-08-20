import { useMemo, useState, useEffect } from 'react';
import { usePluginData } from '@docusaurus/useGlobalData';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {
  buildMatrix,
  formatMatrix,
  groupAndSortAntibiotics,
} from '../utils';

// Helper to recursively flatten the hierarchical sources for easy lookup
const flattenSources = (sources) => {
  const allSources = [];
  const recurse = (sourceList) => {
    for (const source of sourceList) {
      allSources.push(source);
      if (source.children) {
        recurse(source.children);
      }
    }
  };
  recurse(sources);
  return allSources;
};


function decompressData(data) {
  if (!data || data.length < 2) {
    return [];
  }
  const [headers, ...rows] = data;
  return rows.map((row) => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Network response was not ok: ${response.statusText}`);
  }
  return response.json();
}

async function fetchResistanceData(path) {
  const compressedData = await fetchJson(path);
  return decompressData(compressedData);
}

export function useResistanceTableData(
  abxIds,
  orgIds,
  layout,
  selectedSource,
  showEmpty,
) {
  const pluginData = usePluginData(
    'docusaurus-plugin-resistogram',
    'example-resistogram',
  );

  const [sharedData, setSharedData] = useState(null);
  const [resistanceData, setResistanceData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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
      if (!sharedData) return;
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
      } catch (e) {
        setError(e);
      } finally {
        setIsLoading(false); // This is the final loading step
        
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
    () => new Map(Object.entries(classToAbxObj ?? {})),
    [classToAbxObj],
  );

  const sortedAbxIds = useMemo(
    () => groupAndSortAntibiotics(abxIds, allAbxIds ?? [], classToAbx),
    [abxIds, allAbxIds, classToAbx],
  );

  const { rowIds, colIds, rowsAreAbx } = useMemo(() => {
    let rIds = sortedAbxIds;
    let cIds = orgIds;
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
    const nonEmptyCols = new Set();
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

  const hierarchicalSources = pluginData?.sources ?? [];
  const flattendSources = useMemo(() => flattenSources(hierarchicalSources), [hierarchicalSources]);

  return {
    isLoading,
    error,
    data,
    cols,
    rowsAreAbx,
    emptyRowIds: Array.from(emptyRowIds),
    emptyColIds: Array.from(emptyColIds),
    sources: hierarchicalSources,
    flattendSources,
  };
}
