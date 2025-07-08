import { useColorMode } from '@docusaurus/theme-common';
import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { useResistanceTableData } from './hooks/useResistanceTableData';
import { SourceSwitcher } from './ui/components';
import {
  TableHeader,
  TableBody,
  Legend,
} from './components';
import styles from './styles.module.css';

// ============================================================================
// GhostTable for width measurement
// ============================================================================
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

// ============================================================================
// Main component
// ============================================================================
export default function ResistanceTable({
  params: paramString,
  pageText: pageTextJson,
}: {
  params: string;
  pageText: string;
}) {
  // ---------- constant hooks ----------
  const pageText = JSON.parse(pageTextJson) as string;
  const { colorMode } = useColorMode();

  // ---------- state ----------
  const [showEmpty, setShowEmpty] = useState(false);
  const [display, setDisplay] =
    useState<'full' | 'compact' | 'superCompact'>('full');
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<{ row: number | null; col: number | null }>({
    row: null,
    col: null,
  });
  const [selectedSource, setSelectedSource] = useState<any>(null);

  // ---------- refs ----------
  const containerRef = useRef<HTMLDivElement>(null);
  const fullRef = useRef<HTMLTableElement>(null);
  const compactRef = useRef<HTMLTableElement>(null);
  const superRef = useRef<HTMLTableElement>(null);

  // ---------- data fetching ----------
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

  // ---------- effects ----------
  /* pick first source once */
  useEffect(() => {
    if (!selectedSource && sources.length) setSelectedSource(sources[0]);
  }, [sources, selectedSource]);

  /* update showEmpty on param change */
  useEffect(() => setShowEmpty(p.showEmpty === 'true'), [p.showEmpty]);

  /* choose table mode based on width */
  const chooseMode = useCallback(() => {
    const w = containerRef.current?.offsetWidth ?? 0;
    if (!w) return;
    if (fullRef.current && fullRef.current.scrollWidth <= w) setDisplay('full');
    else if (compactRef.current && compactRef.current.scrollWidth <= w)
      setDisplay('compact');
    else setDisplay('superCompact');
  }, []);

  /* measure once ghost tables exist */
  useLayoutEffect(() => {
    if (fullRef.current && compactRef.current && superRef.current) {
      chooseMode();
      if (!ready) setReady(true);
    }
  }, [sources, ready, showEmpty, chooseMode]);

  /* resize listener */
  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const ro = new ResizeObserver(chooseMode);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [ready, chooseMode]);

  // ---------- event handlers ----------
  const handleSetHover = useCallback(
    (row: number, col: number) => setHover({ row, col }),
    [],
  );
  const handleClearHover = useCallback(() => setHover({ row: null, col: null }), []);

  // ---------- render helpers ----------
  const renderHiddenInfo = () => {
    const hiddenRowCount = emptyRowIds.length;
    const hiddenColCount = emptyColIds.length;
    if (!hiddenRowCount && !hiddenColCount) return null;
    const rowLabel = rowsAreAbx ? 'antibiotic' : 'organism';
    const colLabel = rowsAreAbx ? 'organism' : 'antibiotic';
    const parts: string[] = [];
    if (hiddenRowCount)
      parts.push(`${hiddenRowCount} ${rowLabel}${hiddenRowCount > 1 ? 's' : ''}`);
    if (hiddenColCount)
      parts.push(`${hiddenColCount} ${colLabel}${hiddenColCount > 1 ? 's' : ''}`);
    return (
      <div>
        {parts.join(' and ')} {showEmpty ? 'with no data' : 'hidden'} (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setShowEmpty(!showEmpty);
          }}
        >
          {showEmpty ? 'hide' : 'show'}
        </a>
        )
      </div>
    );
  };

  // ---------- early fatal error (plugin missing) ----------
  if (!sources) {
    return <div className={styles.error}>Error: plugin data not found.</div>;
  }

  // ---------- JSX ----------
  return (
    <RadixTooltip.Provider delayDuration={0}>
      <div ref={containerRef}>
        {sources.length > 0 && selectedSource && (
          <SourceSwitcher
            sources={sources}
            selected={selectedSource}
            onSelect={setSelectedSource}
            styles={styles}
          />
        )}

        {/* measurement tables (hidden) */}
        <div style={{ visibility: 'hidden', height: 0, overflow: 'hidden' }}>
          <GhostTable ref={fullRef} displayMode="full" cols={cols} data={data} styles={styles} />
          <GhostTable ref={compactRef} displayMode="compact" cols={cols} data={data} styles={styles} />
          <GhostTable ref={superRef} displayMode="superCompact" cols={cols} data={data} styles={styles} />
        </div>

        {/* main render */}
        {!selectedSource ? (
          <div className={styles.error}>Loading data source…</div>
        ) : !resistanceData.length || !data.length ? (
          <div className={styles.noDataContainer}>
            <p>
              <strong>Resistance Table</strong>
            </p>
            <p>No matching resistance data found in this source.</p>
            <p>The query parameters were:</p>
            <ul>
              <li>Antibiotics: {p.abx || 'all'}</li>
              <li>Organisms: {p.org || 'all'}</li>
            </ul>
          </div>
        ) : (
          ready && (
            <div className={styles.tableContainer}>
              <table
                className={styles.resistanceTable}
                style={{ borderCollapse: 'separate', borderSpacing: 0 }}
              >
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
                  styles={styles}
                  colorMode={colorMode}
                />
              </table>
              <Legend cols={cols} displayMode={display} styles={styles} />
              <div className={styles.sourceInfo}>
                {renderHiddenInfo()}
                Source:{' '}
                <a
                  href={selectedSource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {selectedSource.long_name}
                </a>
              </div>
            </div>
          )
        )}
      </div>
    </RadixTooltip.Provider>
  );
}
