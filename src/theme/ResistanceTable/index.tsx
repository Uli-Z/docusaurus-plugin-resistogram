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

// A simple, non-interactive table used only for measuring its width
// to decide which display mode to use (full, compact, etc.).
const GhostTable = React.forwardRef<
  HTMLTableElement,
  {
    displayMode: 'full' | 'compact' | 'superCompact';
    cols: any[];
    data: any[];
    styles: any;
  }
>(({ displayMode, cols, data, styles }, ref) => (
  <table ref={ref} className={styles.resistanceTable}>
    <thead>
      <tr>
        <th></th>
        {cols.map((c) => (
          <th key={c.id}>
            {displayMode === 'full'
              ? c.name
              : displayMode === 'compact'
              ? c.short
              : 'X'}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {data.map((row) => (
        <tr key={row.rowLong}>
          <td>{displayMode === 'full' ? row.rowLong : row.rowShort}</td>
          {cols.map((c) => (
            <td key={c.id}>-</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
));

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
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<{ row: number | null; col: number | null }>({ row: null, col: null });
  const [selectedSource, setSelectedSource] = useState<any>(null);

  // State for the single, global tooltip
  const [tooltipContent, setTooltipContent] = useState<React.ReactNode>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const virtualTriggerRef = useRef<HTMLSpanElement>(null);

  // Refs for width measurement
  const containerRef = useRef<HTMLDivElement>(null);
  const fullRef = useRef<HTMLTableElement>(null);
  const compactRef = useRef<HTMLTableElement>(null);
  const superRef = useRef<HTMLTableElement>(null);

  const {
    resistanceData,
    data,
    cols,
    rowsAreAbx,
    emptyRowIds,
    emptyColIds,
    sources,
    p,
  } = useResistanceTableData(paramString, pageText, selectedSource, showEmpty);

  // Pre-calculate the width thresholds for each display mode.
  // This is an optimization to avoid querying scrollWidth on every resize event.
  const widths = useMemo(() => {
    if (!ready || !fullRef.current || !compactRef.current) {
      return { full: 9999, compact: 9998 };
    }
    return {
      full: fullRef.current.scrollWidth,
      compact: compactRef.current.scrollWidth,
    };
  }, [ready, sources, showEmpty]); // Recalculate if the underlying data changes

  // This effect sets up the robust ResizeObserver.
  useIsomorphicLayoutEffect(() => {
    if (!containerRef.current) return;

    const node = containerRef.current;
    let raf = 0;

    const HYST = 2; // Hysteresis in pixels to prevent jitter
    const nextMode = (w: number) =>
      w >= widths.full + HYST ? 'full' :
      w >= widths.compact + HYST ? 'compact' : 'superCompact';

    const ro = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(raf);
      // Running the state update inside requestAnimationFrame decouples it
      // from the RO callback, preventing the "loop" error.
      raf = requestAnimationFrame(() => {
        const width = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
        setDisplay(prevMode => {
          const newMode = nextMode(width);
          // Only update state if the mode has actually changed.
          return newMode === prevMode ? prevMode : newMode;
        });
      });
    });

    // Observe the content box to ignore changes from borders or scrollbars.
    ro.observe(node, { box: 'content-box' });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [widths]); // Re-observe if the width thresholds change.


  // Effect to set the initial data source
  useEffect(() => {
    if (!selectedSource && sources.length) setSelectedSource(sources[0]);
  }, [sources, selectedSource]);

  // Effect to update visibility of empty rows/cols based on params
  useEffect(() => setShowEmpty(p.showEmpty === 'true'), [p.showEmpty]);

  // Effect to mark the component as "ready" once the ghost tables have been rendered.
  useIsomorphicLayoutEffect(() => {
    if (fullRef.current && compactRef.current && superRef.current) {
      if (!ready) setReady(true);
    }
  }, [sources, showEmpty, ready]);


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

  if (!sources) {
    return <div className={styles.error}>Error: plugin data not found.</div>;
  }

  return (
    <RadixTooltip.Provider>
      <div ref={containerRef}>
        {sources.length > 0 && selectedSource && (
          <SourceSwitcher
            sources={sources}
            selected={selectedSource}
            onSelect={setSelectedSource}
            styles={styles}
          />
        )}

        <div style={{ visibility: 'hidden', height: 0, overflow: 'hidden' }}>
          <GhostTable ref={fullRef} displayMode="full" cols={cols} data={data} styles={styles} />
          <GhostTable ref={compactRef} displayMode="compact" cols={cols} data={data} styles={styles} />
          <GhostTable ref={superRef} displayMode="superCompact" cols={cols} data={data} styles={styles} />
        </div>

        {!selectedSource ? (
          <div className={styles.error}>Loading data source…</div>
        ) : !resistanceData.length || !data.length ? (
          <div className={styles.noDataContainer}>
            <p><strong>Resistance Table</strong></p>
            <p>No matching resistance data found in this source.</p>
            <ul>
              <li>Antibiotics: {p.abx || 'all'}</li>
              <li>Organisms: {p.org || 'all'}</li>
            </ul>
          </div>
        ) : (
          ready && (
            <div className={styles.tableContainer}>
              <table className={styles.resistanceTable} style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
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
          )
        )}
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
