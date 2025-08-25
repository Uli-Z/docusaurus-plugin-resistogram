import { useColorMode } from '@docusaurus/theme-common';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { SourceSwitcher } from './ui/components';
import { TableHeader, TableBody, Legend } from './components';
import styles from './styles.module.css';
import { groupAndSortAntibiotics, buildMatrix, formatMatrix } from './utils';
import { getTranslator } from './i18n';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const VirtualTrigger = React.forwardRef(function VirtualTrigger(props, ref) {
  return <span ref={ref} style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0 }} />;
});

// Helper to flatten the hierarchical source structure
const flattenSources = (sources) => {
  const allSources = [];
  const recurse = (sourceArray) => {
    for (const source of sourceArray) {
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
  const contentType = response.headers.get('content-type');

  if (!response.ok) {
    if (contentType && contentType.includes('text/html')) {
      throw new Error(`Failed to fetch JSON from '${path}'. The server returned an HTML error page, which likely means the file was not found (404).`);
    }
    throw new Error(`Network response was not ok: ${response.statusText} for path '${path}'.`);
  }

  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    if (text.trim().toLowerCase().startsWith('<!doctype html')) {
      throw new Error(`Failed to fetch JSON from '${path}'. The server returned an HTML page instead of JSON. This likely means the file was not found and the server sent a fallback page.`);
    }
    throw new Error(`Expected JSON response from '${path}', but received content type '${contentType}'.`);
  }

  return response.json();
}

async function fetchResistanceData(path) {
  const compressedData = await fetchJson(path);
  return decompressData(compressedData);
}


export default function ResistanceTable(props) {
  const {
    antibioticIds: antibioticIdsJson,
    organismIds: organismIdsJson,
    unresolvedAbx: unresolvedAbxJson,
    unresolvedOrg: unresolvedOrgJson,
    dataSourceId,
    pluginId,
    layout = 'auto',
    showEmpty: showEmptyProp = 'false',
    locale: localeProp,
    abx: abxParam,
    org: orgParam,
  } = props;

  const antibioticIds = useMemo(() => JSON.parse(antibioticIdsJson), [antibioticIdsJson]);
  const organismIds = useMemo(() => JSON.parse(organismIdsJson), [organismIdsJson]);
  const unresolvedAbx = useMemo(() => JSON.parse(unresolvedAbxJson), [unresolvedAbxJson]);
  const unresolvedOrg = useMemo(() => JSON.parse(unresolvedOrgJson), [unresolvedOrgJson]);

  const { siteConfig, globalData, i18n } = useDocusaurusContext();
  const pluginGlobalData = globalData['docusaurus-plugin-resistogram'][pluginId];
  const { dataUrl, ssr: preloadedData } = pluginGlobalData;

  const locale = localeProp || i18n.currentLocale;
  const t = useMemo(() => getTranslator(locale), [locale]);

  const { colorMode } = useColorMode();

  const [showEmpty, setShowEmpty] = useState(showEmptyProp === 'true');
  const [display, setDisplay] = useState('full');
  const [hover, setHover] = useState({ row: null, col: null });
  const [isClient, setIsClient] = useState(false);

  // This effect runs only on the client, after initial hydration.
  // It triggers a re-render, allowing layout effects to run with correct browser measurements.
  useEffect(() => {
    setIsClient(true);
  }, []);

  const hierarchicalSources = pluginGlobalData?.sources ?? [];
  const flattendSources = useMemo(() => flattenSources(hierarchicalSources), [hierarchicalSources]);

  // Initialize the selected source based on props or the first available source.
  // This is done directly in useState to prevent re-calculation on every render.
  const [selectedSource, setSelectedSource] = useState(() => {
    if (flattendSources.length === 0) return null;
    return dataSourceId
      ? flattendSources.find(s => s.id === dataSourceId) ?? flattendSources[0]
      : flattendSources[0];
  });

  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const virtualTriggerRef = useRef(null);

  const containerRef = useRef(null);
  const tableRef = useRef(null);

  // --- Data Initialization with SSR ---
  // This function retrieves the initial resistance data from the preloaded SSR data.
  const getInitialResistanceData = useCallback((source) => {
    if (!source || !preloadedData?.resistanceData) return null;
    return preloadedData.resistanceData[source.id] ?? null;
  }, [preloadedData]);

  // Initialize state with server-side rendered data if available.
  // This ensures the component renders identically on the server and for the first client render.
  const [sharedData, setSharedData] = useState(preloadedData?.sharedData ?? null);
  const [resistanceData, setResistanceData] = useState(() => getInitialResistanceData(selectedSource));
  const [isLoading, setIsLoading] = useState(!resistanceData); // Only show loading spinner if data wasn't preloaded.
  const [error, setError] = useState(null);
  // --- End Data Initialization ---

  const resistanceFileName = selectedSource ? pluginGlobalData.resistanceDataFileNames?.[selectedSource.id] : null;
  const resistanceDataUrl = resistanceFileName ? `${dataUrl}/${resistanceFileName}` : null;

  // Effect to fetch shared data on the client ONLY if it wasn't available from SSR.
  useEffect(() => {
    async function loadShared() {
      if (sharedData) return; 
      if (!pluginGlobalData.sharedDataFileName) {
        setError(new Error("Plugin data not found."));
        setIsLoading(false);
        return;
      }
      try {
        const sharedDataUrl = `${dataUrl}/${pluginGlobalData.sharedDataFileName}`;
        const data = await fetchJson(sharedDataUrl);
        setSharedData(data);
      } catch (e) {
        setError(e);
        setIsLoading(false);
      }
    }
    loadShared();
  }, [sharedData, pluginGlobalData, dataUrl]);

  // Effect to fetch new resistance data when the user selects a different source.
  useEffect(() => {
    // Don't fetch data for the initial source that was already rendered on the server.
    const initialData = getInitialResistanceData(selectedSource);
    if (initialData && JSON.stringify(resistanceData) === JSON.stringify(initialData)) {
      setIsLoading(false);
      return;
    }

    async function loadResistance() {
      if (!sharedData) return; // Wait for shared data to be available.
      if (!resistanceDataUrl || !selectedSource) {
        setResistanceData(null);
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const data = await fetchResistanceData(resistanceDataUrl);
        setResistanceData(data);
      } catch (e) {
        setError(new Error(`Failed to fetch resistance data from ${resistanceDataUrl}: ${e.message}`));
      } finally {
        setIsLoading(false);
      }
    }
    loadResistance();
  }, [resistanceDataUrl, selectedSource, sharedData]);

  const {
    id2MainSyn: id2Main,
    id2ShortName: id2Short,
    allAbxIds,
    orgIdToRank,
    classToAbx: classToAbxObj,
  } = sharedData || {};

  const classToAbx = useMemo(
    () => new Map(Object.entries(classToAbxObj ?? {})),
    [classToAbxObj],
  );

  const sortedAbxIds = useMemo(
    () => groupAndSortAntibiotics(antibioticIds, allAbxIds ?? [], classToAbx),
    [antibioticIds, allAbxIds, classToAbx],
  );

  const sortedOrganismIds = useMemo(() => {
    if (!orgIdToRank) return organismIds;
    return [...organismIds].sort((a, b) => {
      const rankA = orgIdToRank[a] || '99';
      const rankB = orgIdToRank[b] || '99';
      return rankA.localeCompare(rankB);
    });
  }, [organismIds, orgIdToRank]);

  const { rowIds, colIds, rowsAreAbx } = useMemo(() => {
    let rIds = sortedAbxIds;
    let cIds = sortedOrganismIds;
    let rAreAbx = true;

    if (layout === 'organisms-rows') {
      rIds = sortedOrganismIds;
      cIds = sortedAbxIds;
      rAreAbx = false;
    } else if (layout === 'auto') {
      if (sortedOrganismIds.length > 4 && antibioticIds.length && sortedOrganismIds.length / antibioticIds.length > 2) {
        rIds = sortedOrganismIds;
        cIds = sortedAbxIds;
        rAreAbx = false;
      }
    }
    return { rowIds: rIds, colIds: cIds, rowsAreAbx: rAreAbx };
  }, [layout, sortedAbxIds, sortedOrganismIds]);

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
    () => {
      return formatMatrix(matrix, finalRowIds, finalColIds, new Map(Object.entries(id2Main ?? {})), new Map(Object.entries(id2Short ?? {})), locale)
    },
    [matrix, finalRowIds, finalColIds, id2Main, id2Short, locale],
  );
  
  const sourceId2ShortName = useMemo(() => {
    const map = new Map();
    flattendSources.forEach(s => {
      const shortName = s[`source_short_name_${locale}`] || s[`name_${locale}`] || s.source_short_name_en || s.name_en || s.id;
      map.set(s.id, shortName);
    });
    return map;
  }, [flattendSources, locale]);

  const sourceChain = useMemo(() => {
    if (!selectedSource || flattendSources.length === 0) {
      return [];
    }
    const chain = [];
    let currentSource = selectedSource;
    while (currentSource) {
      chain.push(currentSource);
      if (currentSource.parent_id) {
        currentSource = flattendSources.find(s => s.id === currentSource.parent_id);
      } else {
        currentSource = undefined;
      }
    }
    return chain.reverse(); // Reverse to show parent first
  }, [selectedSource, flattendSources]);

  useIsomorphicLayoutEffect(() => {
    // On the client, after the isClient state is set, this effect will re-run.
    // This ensures that measurements are taken after the browser has finalized its layout.
    if (isLoading || error || !containerRef.current || !tableRef.current) return;

    const containerWidth = containerRef.current.clientWidth;
    const tableWidth = tableRef.current.scrollWidth;
    const HYST = 2; // Hysteresis to prevent flickering
    if (display === 'full' && tableWidth > containerWidth + HYST) {
      setDisplay('compact');
    } else if (display === 'compact' && tableWidth > containerWidth + HYST) {
      setDisplay('superCompact');
    }
  }, [display, data, cols, isLoading, error, isClient]);

  useIsomorphicLayoutEffect(() => {
    if (!containerRef.current) return;
    const node = containerRef.current;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setDisplay('full');
      });
    });
    ro.observe(node, { box: 'content-box' });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    // When the showEmpty prop changes, reset the display to 'full'
    // to allow the table to re-measure its layout.
    setDisplay('full');
  }, [showEmptyProp]);

  const showTooltip = useCallback((content, element) => {
    const timeoutId = setTimeout(() => {
      if (!virtualTriggerRef.current) return;
      const rect = element.getBoundingClientRect();
      virtualTriggerRef.current.style.left = `${rect.left + rect.width / 2}px`;
      virtualTriggerRef.current.style.top = `${rect.top}px`;
      setTooltipContent(content);
      setTooltipOpen(true);
    }, 50);
    return () => clearTimeout(timeoutId);
  }, []);

  const hideTooltip = useCallback(() => setTooltipOpen(false), []);

  const handleSetHover = useCallback((row, col) => setHover({ row, col }), []);
  const handleClearHover = useCallback(() => setHover({ row: null, col: null }), []);

  const renderHiddenInfo = () => {
    const hiddenRowCount = emptyRowIds.size;
    const hiddenColCount = emptyColIds.size;
    if (!hiddenRowCount && !hiddenColCount) return null;
    
    const rowLabel = rowsAreAbx ? t(hiddenRowCount > 1 ? 'antibiotics' : 'antibiotic') : t(hiddenRowCount > 1 ? 'organisms' : 'organism');
    const colLabel = rowsAreAbx ? t(hiddenColCount > 1 ? 'organisms' : 'organism') : t(hiddenColCount > 1 ? 'antibiotics' : 'antibiotic');

    const parts = [];
    if (hiddenRowCount) parts.push(`${hiddenRowCount} ${rowLabel}`);
    if (hiddenColCount) parts.push(`${hiddenColCount} ${colLabel}`);

    return (
      <div>
        {parts.join(` ${t('hiddenInfoAnd')} `)} {showEmpty ? t('hiddenInfoWithNoData') : t('hiddenInfoHidden')} (
        <a href="#" onClick={(e) => { e.preventDefault(); setShowEmpty(!showEmpty); }}>
          {showEmpty ? t('hide') : t('show')}
        </a>
        )
      </div>
    );
  };

  const renderContent = () => {
    const isStale = isLoading && data && data.length > 0;
    const isInitialLoad = isLoading && (!data || data.length === 0);

    if (isInitialLoad) return <div className={styles.placeholder}><div className={styles.spinner} />{t('loading')}</div>;
    if (error) return <div className={styles.error}>{t('generationFailed')}: {error.message}</div>;

    const unresolvedIds = [...unresolvedAbx, ...unresolvedOrg];
    if (unresolvedIds.length > 0) {
      return (
        <div className={styles.noDataContainer}>
          <p><strong>{t('resistanceTable')}</strong></p>
          <p>{t('unrecognizedIdentifiers')}:</p>
          <ul className={styles.noDataList}>
            {unresolvedIds.map(id => <li key={id}><code>{id}</code></li>)}
          </ul>
        </div>
      );
    }

    if (!data || data.length === 0) {
      // If no invalid IDs, it means the combination yielded no results.
      const idToName = (id) => id2Main?.[id]?.[`name_${locale}`] || id;
      const abxNames = antibioticIds.map(idToName);
      const orgNames = organismIds.map(idToName);

      return (
        <div className={styles.noDataContainer}>
          <p><strong>{t('resistanceTable')}</strong></p>
          <p>{t('noDataForCombination')}:</p>
          {abxNames.length > 0 && (
            <p><strong>{t('antibiotics')}:</strong> {abxNames.join(', ')}</p>
          )}
          {orgNames.length > 0 && (
            <p><strong>{t('organisms')}:</strong> {orgNames.join(', ')}</p>
          )}
           {abxNames.length === 0 && orgNames.length === 0 && (
            <p>{t('noData')}</p>
          )}
        </div>
      );
    }

    return (
      <>
        {isStale && <div className={styles.tableOverlay}><div className={styles.spinner} /></div>}
        <table ref={tableRef} className={styles.resistanceTable} style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <TableHeader {...{ cols, displayMode: display, hoveredCol: hover.col, onSetHover: handleSetHover, onClearHover: handleClearHover, onShowTooltip: showTooltip, onHideTooltip: hideTooltip, styles }} />
          <TableBody {...{ data, cols, displayMode: display, rowsAreAbx, hoveredRow: hover.row, hoveredCol: hover.col, onSetHover: handleSetHover, onClearHover: handleClearHover, onShowTooltip: showTooltip, onHideTooltip: hideTooltip, styles, colorMode, sourceId2ShortName, t }} />
        </table>
        <Legend {...{ cols, displayMode: display, styles }} />
        <div className={styles.sourceInfo}>
          {renderHiddenInfo()}
          {sourceChain.length > 0 && (
            <>
              {sourceChain.length > 1 ? t('sources') : t('source')}:{' '}
              {sourceChain.map((source, index) => {
                const longName = source[`source_long_name_${locale}`] || source[`name_${locale}`] || source.source_long_name_en || source.name_en || source.id;
                return (
                  <React.Fragment key={source.id}>
                    {source.url ? (
                      <a href={source.url} target="_blank" rel="noopener noreferrer">
                        {longName}
                      </a>
                    ) : (
                      <span>{longName}</span>
                    )}
                    {index < sourceChain.length - 1 && ', '}
                  </React.Fragment>
                );
              })}
            </>
          )}
        </div>
      </>
    );
  };

  if (!pluginGlobalData) return <div className={styles.error}>{t('error')}: {t('pluginError')}</div>;

  return (
    <RadixTooltip.Provider>
      <div ref={containerRef} style={{ minHeight: '150px' }}>
        <div className={styles.rootContainer}>
          {hierarchicalSources.length > 0 && (
            <SourceSwitcher {...{ sources: hierarchicalSources, selected: selectedSource, onSelect: setSelectedSource, styles, locale }} />
          )}
          <div className={styles.tableContainer}>
            {renderContent()}
          </div>
        </div>
      </div>

      <RadixTooltip.Root open={tooltipOpen} onOpenChange={setTooltipOpen}>
        <RadixTooltip.Trigger asChild><VirtualTrigger ref={virtualTriggerRef} /></RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content side="top" align="center" sideOffset={5} className={styles.tooltipContent}>
            {tooltipContent}
            <RadixTooltip.Arrow width={8} height={4} className={styles.tooltipArrow} />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
