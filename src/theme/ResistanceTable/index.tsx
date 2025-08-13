import { useColorMode } from '@docusaurus/theme-common';
import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { useResistanceTableData } from './hooks/useResistanceTableData';
import { SourceSwitcher } from './ui/components';
import { TableHeader, TableBody, Legend } from './components';
import styles from './styles.module.css';

// A helper hook to safely use useLayoutEffect on the client and
// fall back to useEffect on the server to prevent warnings during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// This is a virtual, invisible trigger for the single global tooltip.
const VirtualTrigger = React.forwardRef<HTMLSpanElement, {}>(function VirtualTrigger(props, ref) {
  return <span ref={ref} style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0 }} />;
});

interface ResistanceTableProps {
  antibioticIds: string[];
  organismIds: string[];
  layout?: 'auto' | 'antibiotics-rows' | 'organisms-rows';
  showEmpty?: 'true' | 'false';
}

export default function ResistanceTable(props: Omit<ResistanceTableProps, 'antibioticIds' | 'organismIds'> & { antibioticIds: string, organismIds: string }) {
  const {
    antibioticIds: antibioticIdsJson,
    organismIds: organismIdsJson,
    layout = 'auto',
    showEmpty: showEmptyProp = 'false',
  } = props;

  // The props from MDX are strings, so we need to parse them back into arrays.
  const antibioticIds = useMemo(() => JSON.parse(antibioticIdsJson), [antibioticIdsJson]);
  const organismIds = useMemo(() => JSON.parse(organismIdsJson), [organismIdsJson]);


  const { colorMode } = useColorMode();

  // State for table interactivity and display
  const [showEmpty, setShowEmpty] = useState(showEmptyProp === 'true');
  const [display, setDisplay] = useState<'full' | 'compact' | 'superCompact'>('full');
  const [isVisible, setIsVisible] = useState(false);
  const [hover, setHover] = useState<{ row: number | null; col: number | null }>({ row: null, col: null });
  const [selectedSource, setSelectedSource] = useState<any>(null);

  // State for the single, global tooltip
  const [tooltipContent, setTooltipContent] = useState<React.ReactNode>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const virtualTriggerRef = useRef<HTMLSpanElement>(null);

  // Refs for measurement
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const {
    isLoading,
    error,
    data,
    cols,
    rowsAreAbx,
    emptyRowIds,
    emptyColIds,
    sources,
  } = useResistanceTableData(antibioticIds, organismIds, layout, selectedSource, showEmpty);

  // "Render, Shrink, then Show" logic
  useIsomorphicLayoutEffect(() => {
    if (isLoading || error || !containerRef.current || !tableRef.current) return;

    const containerWidth = containerRef.current.clientWidth;
    const tableWidth = tableRef.current.scrollWidth;
    const HYST = 2; // Hysteresis

    if (display === 'full' && tableWidth > containerWidth + HYST) {
      setDisplay('compact');
      return;
    }
    if (display === 'compact' && tableWidth > containerWidth + HYST) {
      setDisplay('superCompact');
      return;
    }
    if (!isVisible) {
      setIsVisible(true);
    }
  }, [display, isVisible, data, cols, isLoading, error]);

  // Resize observer to handle container size changes
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

  // Set initial data source
  useEffect(() => {
    if (!selectedSource && sources.length) setSelectedSource(sources[0]);
  }, [sources, selectedSource]);

  // Update showEmpty state when prop changes
  useEffect(() => {
    setShowEmpty(showEmptyProp === 'true');
    setDisplay('full');
    setIsVisible(false);
  }, [showEmptyProp]);

  // Tooltip handling callbacks
  const showTooltip = useCallback((content: React.ReactNode, element: HTMLElement) => {
    clearTimeout(showTooltipTimeout.current);
    showTooltipTimeout.current = setTimeout(() => {
      if (!virtualTriggerRef.current) return;
      const rect = element.getBoundingClientRect();
      virtualTriggerRef.current.style.left = `${rect.left + rect.width / 2}px`;
      virtualTriggerRef.current.style.top = `${rect.top}px`;
      setTooltipContent(content);
      setTooltipOpen(true);
    }, 50);
  }, []);

  const hideTooltip = useCallback(() => {
    clearTimeout(showTooltipTimeout.current);
    setTooltipOpen(false);
  }, []);
  const showTooltipTimeout = useRef<NodeJS.Timeout>();

  // Hover handling callbacks
  const handleSetHover = useCallback((row: number, col: number) => setHover({ row, col }), []);
  const handleClearHover = useCallback(() => setHover({ row: null, col: null }), []);

  const renderHiddenInfo = () => {
    const hiddenRowCount = emptyRowIds.length;
    const hiddenColCount = emptyColIds.length;
    if (!hiddenRowCount && !hiddenColCount) return null;
    const rowLabel = rowsAreAbx ? 'antibiotic' : 'organism';
    const colLabel = rowsAreAbx ? 'organism' : 'antibiotic';
    const parts: string[] = [];
    if (hiddenRowCount) parts.push(`${hiddenRowCount} ${rowLabel}${hiddenRowCount > 1 ? 's' : ''}`);
    if (hiddenColCount) parts.push(`${hiddenColCount} ${colLabel}${hiddenColCount > 1 ? 's' : ''}`);
    return (
      <div>
        {parts.join(' and ')} {showEmpty ? 'with no data' : 'hidden'} (
        <a href="#" onClick={(e) => { e.preventDefault(); setShowEmpty(!showEmpty); }}>
          {showEmpty ? 'hide' : 'show'}
        </a>
        )
      </div>
    );
  };

  const renderContent = () => {
    const isStale = isLoading && data && data.length > 0;
    const isInitialLoad = isLoading && (!data || data.length === 0);

    if (isInitialLoad) {
      return (
        <div className={styles.placeholder}>
          <div className={styles.spinner} />
          Loading resistance data...
        </div>
      );
    }
    if (error) {
      return <div className={styles.error}>Error: {error.message}</div>;
    }
    if (!data || data.length === 0) {
      return (
        <div className={styles.noDataContainer}>
          <p><strong>Resistance Table</strong></p>
          <p>No matching resistance data found for the selected criteria in this source.</p>
        </div>
      );
    }

    return (
      <>
        {isStale && (
          <div className={styles.tableOverlay}>
            <div className={styles.spinner} />
          </div>
        )}
        <table ref={tableRef} className={styles.resistanceTable} style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <TableHeader {...{ cols, displayMode: display, hoveredCol: hover.col, onSetHover: handleSetHover, onClearHover: handleClearHover, onShowTooltip: showTooltip, onHideTooltip: hideTooltip, styles }} />
          <TableBody {...{ data, cols, displayMode: display, rowsAreAbx, hoveredRow: hover.row, hoveredCol: hover.col, onSetHover: handleSetHover, onClearHover: handleClearHover, onShowTooltip: showTooltip, onHideTooltip: hideTooltip, styles, colorMode }} />
        </table>
        <Legend {...{ cols, displayMode: display, styles }} />
        <div className={styles.sourceInfo}>
          {renderHiddenInfo()}
          Source:{' '}
          <a href={selectedSource.url} target="_blank" rel="noopener noreferrer">
            {selectedSource.long_name}
          </a>
        </div>
      </>
    );
  };

  if (!sources) {
    return <div className={styles.error}>Error: Docusaurus plugin data not found.</div>;
  }

  return (
    <RadixTooltip.Provider>
      <div ref={containerRef} style={{ visibility: isVisible ? 'visible' : 'hidden', minHeight: '150px' }}>
        <div className={styles.rootContainer}>
          {sources.length > 0 && (
            <SourceSwitcher {...{ sources, selected: selectedSource, onSelect: setSelectedSource, styles }} />
          )}
          <div className={styles.tableContainer}>
            {renderContent()}
          </div>
        </div>
        {!isVisible && !isLoading && <div className={styles.placeholder}>Calculating table layout...</div>}
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