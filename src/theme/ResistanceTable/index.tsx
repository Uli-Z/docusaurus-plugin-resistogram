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
import { Source } from '../../../types';
import { groupAndSortAntibiotics, buildMatrix, formatMatrix } from './utils';
import { getTranslator, Locale } from './i18n';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const VirtualTrigger = React.forwardRef<HTMLSpanElement, {}>(function VirtualTrigger(props, ref) {
  return <span ref={ref} style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0 }} />;
});

interface ResistanceTableProps {
  antibioticIds: string[];
  organismIds: string[];
  dataSourceId?: string;
  layout?: 'auto' | 'antibiotics-rows' | 'organisms-rows';
  showEmpty?: 'true' | 'false';
  locale?: Locale;
}

// Helper to flatten the hierarchical source structure
const flattenSources = (sources: Source[]): Source[] => {
  const allSources: Source[] = [];
  const recurse = (sourceArray: Source[]) => {
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


export default function ResistanceTable(props: Omit<ResistanceTableProps, 'antibioticIds' | 'organismIds'> & { antibioticIds: string, organismIds: string, dataSourceId?: string, locale?: Locale }) {
  // --- DEBUGGING ---
  try {
    console.log('--- ResistanceTable Props ---', {
      ...props,
      antibioticIds: JSON.parse(props.antibioticIds),
      organismIds: JSON.parse(props.organismIds),
    });
  } catch (e) {
    console.error("Could not parse props:", props);
  }
  // --- END DEBUGGING ---

  const {
    antibioticIds: antibioticIdsJson,
    organismIds: organismIdsJson,
    dataSourceId,
    layout = 'auto',
    showEmpty: showEmptyProp = 'false',
    locale: localeProp,
  } = props;

  const antibioticIds = useMemo(() => JSON.parse(antibioticIdsJson), [antibioticIdsJson]);
  const organismIds = useMemo(() => JSON.parse(organismIdsJson), [organismIdsJson]);

  const { siteConfig, globalData, i18n } = useDocusaurusContext();
  const { baseUrl } = siteConfig;
  const pluginData = globalData['docusaurus-plugin-resistogram']['example-resistogram'];

  const locale = localeProp || i18n.currentLocale as Locale;
  const t = useMemo(() => getTranslator(locale), [locale]);

  const { colorMode } = useColorMode();

  const [showEmpty, setShowEmpty] = useState(showEmptyProp === 'true');
  const [display, setDisplay] = useState<'full' | 'compact' | 'superCompact'>('full');
  const [isVisible, setIsVisible] = useState(false);
  const [hover, setHover] = useState<{ row: number | null; col: number | null }>({ row: null, col: null });
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);

  const [tooltipContent, setTooltipContent] = useState<React.ReactNode>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const virtualTriggerRef = useRef<HTMLSpanElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const [sharedData, setSharedData] = useState<any | null>(null);
  const [resistanceData, setResistanceData] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const sharedDataUrl = pluginData.sharedDataFileName ? `${baseUrl}assets/json/${pluginData.sharedDataFileName}` : null;
  const resistanceFileName = selectedSource ? pluginData.resistanceDataFileNames?.[selectedSource.id] : null;
  const resistanceDataUrl = resistanceFileName ? `${baseUrl}assets/json/${resistanceFileName}` : null;

  useEffect(() => {
    async function loadShared() {
      if (!sharedDataUrl) {
        setError(new Error("Plugin data not found."));
        setIsLoading(false);
        return;
      }
      try {
        const data = await fetchJson(sharedDataUrl);
        setSharedData(data);
      } catch (e) {
        setError(e);
        setIsLoading(false);
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
        return;
      }
      try {
        setIsLoading(true);
        const data = await fetchResistanceData(resistanceDataUrl);
        setResistanceData(data);
      } catch (e) {
        setError(e);
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
    classToAbx: classToAbxObj,
  } = sharedData || {};

  const classToAbx = useMemo(
    () => new Map<string, string[]>(Object.entries(classToAbxObj ?? {})),
    [classToAbxObj],
  );

  const sortedAbxIds = useMemo(
    () => groupAndSortAntibiotics(antibioticIds, allAbxIds ?? [], classToAbx),
    [antibioticIds, allAbxIds, classToAbx],
  );

  const { rowIds, colIds, rowsAreAbx } = useMemo(() => {
    let rIds: string[] = sortedAbxIds;
    let cIds: string[] = organismIds;
    let rAreAbx = true;

    if (layout === 'organisms-rows') {
      rIds = organismIds;
      cIds = sortedAbxIds;
      rAreAbx = false;
    } else if (layout === 'auto') {
      if (organismIds.length > 4 && antibioticIds.length && organismIds.length / antibioticIds.length > 2) {
        rIds = organismIds;
        cIds = sortedAbxIds;
        rAreAbx = false;
      }
    }
    return { rowIds: rIds, colIds: cIds, rowsAreAbx: rAreAbx };
  }, [layout, sortedAbxIds, organismIds]);

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
    () => {
      return formatMatrix(matrix, finalRowIds, finalColIds, new Map(Object.entries(id2Main ?? {})), new Map(Object.entries(id2Short ?? {})), locale)
    },
    [matrix, finalRowIds, finalColIds, id2Main, id2Short, locale],
  );
  
  const hierarchicalSources = pluginData?.sources ?? [];
  const flattendSources = useMemo(() => flattenSources(hierarchicalSources), [hierarchicalSources]);

  const sourceId2ShortName = useMemo(() => {
    const map = new Map<string, string>();
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
    const chain: Source[] = [];
    let currentSource: Source | undefined = selectedSource;
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
    if (isLoading || error || !containerRef.current || !tableRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const tableWidth = tableRef.current.scrollWidth;
    const HYST = 2;
    if (display === 'full' && tableWidth > containerWidth + HYST) setDisplay('compact');
    else if (display === 'compact' && tableWidth > containerWidth + HYST) setDisplay('superCompact');
    if (!isVisible) setIsVisible(true);
  }, [display, isVisible, data, cols, isLoading, error]);

  useIsomorphicLayoutEffect(() => {
    if (!containerRef.current) return;
    const node = containerRef.current;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setDisplay('full');
        setIsVisible(false);
      });
    });
    ro.observe(node, { box: 'content-box' });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    if (flattendSources.length > 0) {
      const initialSource = dataSourceId
        ? flattendSources.find(s => s.id === dataSourceId)
        : flattendSources[0];
      setSelectedSource(initialSource || flattendSources[0]);
    }
  }, [flattendSources, dataSourceId]);

  useEffect(() => {
    setShowEmpty(showEmptyProp === 'true');
    setDisplay('full');
    setIsVisible(false);
  }, [showEmptyProp]);

  const showTooltip = useCallback((content: React.ReactNode, element: HTMLElement) => {
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

  const handleSetHover = useCallback((row: number, col: number) => setHover({ row, col }), []);
  const handleClearHover = useCallback(() => setHover({ row: null, col: null }), []);

  const renderHiddenInfo = () => {
    const hiddenRowCount = emptyRowIds.size;
    const hiddenColCount = emptyColIds.size;
    if (!hiddenRowCount && !hiddenColCount) return null;
    
    const rowLabel = rowsAreAbx ? t(hiddenRowCount > 1 ? 'antibiotics' : 'antibiotic') : t(hiddenRowCount > 1 ? 'organisms' : 'organism');
    const colLabel = rowsAreAbx ? t(hiddenColCount > 1 ? 'organisms' : 'organism') : t(hiddenColCount > 1 ? 'antibiotics' : 'antibiotic');

    const parts: string[] = [];
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
    if (error) return <div className={styles.error}>{t('error')}: {error.message}</div>;
    if (!data || data.length === 0) {
      return (
        <div className={styles.noDataContainer}>
          <p><strong>{t('resistanceTable')}</strong></p>
          <p>{t('noData')}</p>
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

  if (!pluginData) return <div className={styles.error}>{t('error')}: {t('pluginError')}</div>;

  return (
    <RadixTooltip.Provider>
      <div ref={containerRef} style={{ visibility: isVisible ? 'visible' : 'hidden', minHeight: '150px' }}>
        <div className={styles.rootContainer}>
          {hierarchicalSources.length > 0 && (
            <SourceSwitcher {...{ sources: hierarchicalSources, selected: selectedSource, onSelect: setSelectedSource, styles, locale }} />
          )}
          <div className={styles.tableContainer}>
            {renderContent()}
          </div>
        </div>
        {!isVisible && !isLoading && <div className={styles.placeholder}>{t('calculatingLayout')}</div>}
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
