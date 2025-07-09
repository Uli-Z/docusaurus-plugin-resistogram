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
// Radix UI will use this element's position to place the tooltip.
// We manually update its position to match the currently hovered cell.
const VirtualTrigger = React.forwardRef<HTMLSpanElement, {}>(function VirtualTrigger(props, ref) {
  return <span ref={ref} style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0 }} />;
});


export default function ResistanceTable({
  params: paramString,
  pageText: pageTextJson,
}: {
  params: string;
  pageText: string;
}) {
  const pageText = JSON.parse(pageTextJson) as string;
  const { colorMode } = useColorMode();

  // State for table interactivity and display
  const [showEmpty, setShowEmpty] = useState(false);
  const [display, setDisplay] = useState<'full' | 'compact' | 'superCompact'>('full');
  const [isVisible, setIsVisible] = useState(false); // Start as invisible
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
    resistanceData,
    data,
    cols,
    rowsAreAbx,
    emptyRowIds,
    emptyColIds,
    sources,
    p,
  } = useResistanceTableData(paramString, pageText, selectedSource, showEmpty);

  // This layout effect is the core of the "Render, Shrink, then Show" logic.
  // It runs synchronously after a render but before the browser paints.
  useIsomorphicLayoutEffect(() => {
    if (isLoading || error || !containerRef.current || !tableRef.current) return;

    const containerWidth = containerRef.current.clientWidth;
    const tableWidth = tableRef.current.scrollWidth;

    const HYST = 2; // Hysteresis

    // 1. Shrink if necessary
    if (display === 'full' && tableWidth > containerWidth + HYST) {
      setDisplay('compact');
      return; // Re-render will trigger this effect again
    }
    if (display === 'compact' && tableWidth > containerWidth + HYST) {
      setDisplay('superCompact');
      return; // Re-render will trigger this effect again
    }

    // 2. Once stable, make it visible
    if (!isVisible) {
      setIsVisible(true);
    }

  }, [display, isVisible, data, cols, isLoading, error]); // Rerun if display mode or data changes

  // This effect handles resizing of the container after the initial render.
  useIsomorphicLayoutEffect(() => {
    if (!containerRef.current) return;

    const node = containerRef.current;
    let raf = 0;

    const ro = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // On resize, we reset to 'full' and let the shrink logic handle it.
        // This correctly handles cases where the container grows.
        setDisplay('full');
        setIsVisible(false); // Hide to prevent flicker on resize
      });
    });

    ro.observe(node, { box: 'content-box' });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []); // Only runs once to attach the observer


  // Effect to set the initial data source
  useEffect(() => {
    if (!selectedSource && sources.length) setSelectedSource(sources[0]);
  }, [sources, selectedSource]);

  // Effect to update visibility of empty rows/cols based on params
  useEffect(() => {
    setShowEmpty(p.showEmpty === 'true');
    // When params change, we need to re-evaluate the layout
    setDisplay('full');
    setIsVisible(false);
  }, [p.showEmpty]);


  const showTooltipTimeout = useRef<NodeJS.Timeout>();

  // Callbacks for the global tooltip
  const showTooltip = useCallback((content: React.ReactNode, element: HTMLElement) => {
    // Clear any pending tooltip show events
    clearTimeout(showTooltipTimeout.current);

    // Set a new timeout to show the tooltip after a short delay
    showTooltipTimeout.current = setTimeout(() => {
      if (!virtualTriggerRef.current) return;
      const rect = element.getBoundingClientRect();
      virtualTriggerRef.current.style.left = `${rect.left + rect.width / 2}px`;
      virtualTriggerRef.current.style.top = `${rect.top}px`;
      setTooltipContent(content);
      setTooltipOpen(true);
    }, 50); // A 50ms delay is usually enough to prevent race conditions
  }, []);

  const hideTooltip = useCallback(() => {
    // Clear any pending tooltip show events
    clearTimeout(showTooltipTimeout.current);
    // Hide the tooltip immediately
    setTooltipOpen(false);
  }, []);

  // Callbacks for row/column highlighting
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
    if (isLoading) {
      return <div className={styles.placeholder}>Loading resistance data...</div>;
    }
    if (error) {
      return <div className={styles.error}>Error: {error.message}</div>;
    }
    if (!resistanceData || !data || !cols) {
      return <div className={styles.error}>No data available.</div>;
    }
    if (!resistanceData.length || !data.length) {
      return (
        <div className={styles.noDataContainer}>
          <p><strong>Resistance Table</strong></p>
          <p>No matching resistance data found in this source.</p>
          <ul>
            <li>Antibiotics: {p.abx || 'all'}</li>
            <li>Organisms: {p.org || 'all'}</li>
          </ul>
        </div>
      );
    }

    return (
      <div style={{ visibility: isVisible ? 'visible' : 'hidden' }}>
        <div className={styles.tableContainer}>
          <table ref={tableRef} className={styles.resistanceTable} style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHeader
              cols={cols}
              displayMode={display}
              hoveredCol={hover.col}
              onSetHover={handleSetHover}
              onClearHover={handleClearHover}
              styles={styles}
            />
            <TableBody
              data={data}
              cols={cols}
              displayMode={display}
              rowsAreAbx={rowsAreAbx}
              hoveredRow={hover.row}
              hoveredCol={hover.col}
              onSetHover={handleSetHover}
              onClearHover={handleClearHover}
              onShowTooltip={showTooltip}
              onHideTooltip={hideTooltip}
              styles={styles}
              colorMode={colorMode}
            />
          </table>
          <Legend cols={cols} displayMode={display} styles={styles} />
          <div className={styles.sourceInfo}>
            {renderHiddenInfo()}
            Source:{' '}
            <a href={selectedSource.url} target="_blank" rel="noopener noreferrer">
              {selectedSource.long_name}
            </a>
          </div>
        </div>
        {!isVisible && !isLoading && <div className={styles.placeholder}>Calculating table layout...</div>}
      </div>
    );
  };

  if (!sources) {
    return <div className={styles.error}>Error: plugin data not found.</div>;
  }

  return (
    <RadixTooltip.Provider>
      <div ref={containerRef}>
        {sources.length > 0 && (
          <SourceSwitcher
            sources={sources}
            selected={selectedSource}
            onSelect={setSelectedSource}
            styles={styles}
          />
        )}
        {renderContent()}
      </div>

      {/* This is the single, global tooltip that provides high performance. */}
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
