import { useColorMode } from '@docusaurus/theme-common';
import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { useResistanceTableData } from './hooks/useResistanceTableData';
import {
  CellTooltipContent,
  SourceSwitcher,
  Tip,
} from './ui/components';
import styles from './styles.module.css';

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

  const [showEmpty, setShowEmpty] = useState(false);
  const [display, setDisplay] =
    useState<'full' | 'compact' | 'superCompact'>('full');
  const [ready, setReady] = useState(false);
  const [hoverRow, setHoverRow] = useState<number | null>(null);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [selectedSource, setSelectedSource] = useState<any>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const fullRef = useRef<HTMLTableElement>(null);
  const compactRef = useRef<HTMLTableElement>(null);
  const superRef = useRef<HTMLTableElement>(null);
  const lastHoveredCell = useRef<HTMLElement | null>(null);

  const {
    resistanceData,
    data,
    cols,
    rowsAreAbx,
    emptyRowIds,
    emptyColIds,
    sources,
    abxIds,
    orgIds,
    p,
    id2Main
  } = useResistanceTableData(paramString, pageText, selectedSource, showEmpty);

  // ---------- effects ----------
  /* pick first source once */
  useEffect(() => {
    if (!selectedSource && sources.length) setSelectedSource(sources[0]);
  }, [sources, selectedSource]);

  /* update showEmpty on param change */
  useEffect(() => setShowEmpty(p.showEmpty === 'true'), [p.showEmpty]);

  /* choose table mode based on width */
  const chooseMode = () => {
    const w = containerRef.current?.offsetWidth ?? 0;
    if (!w) return;
    if (fullRef.current && fullRef.current.scrollWidth <= w) setDisplay('full');
    else if (compactRef.current && compactRef.current.scrollWidth <= w)
      setDisplay('compact');
    else setDisplay('superCompact');
  };

  /* measure once ghost tables exist */
  useLayoutEffect(() => {
    if (fullRef.current && compactRef.current && superRef.current) {
      chooseMode();
      if (!ready) setReady(true);
    }
  }, [sources, ready, showEmpty]);

  /* resize listener */
  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const ro = new ResizeObserver(() => chooseMode());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [ready]);

  // ---------- table cell hover helpers ----------
  const handleMouseOver = (e: React.MouseEvent<HTMLTableElement>) => {
    const cell = (e.target as HTMLElement).closest('td, th');
    if (!cell || cell === lastHoveredCell.current) return;
    lastHoveredCell.current = cell;
    setHoverCol(cell.cellIndex - 1);
    setHoverRow((cell.parentNode as HTMLTableRowElement).rowIndex - 1);
  };
  const handleMouseLeave = () => {
    setHoverCol(null);
    setHoverRow(null);
    lastHoveredCell.current = null;
  };

  const pctToColor = (pct: number) => {
    const hue = Math.round((1 - pct / 100) * 120);
    return colorMode === 'dark'
      ? `hsl(${hue},40%,30%)`
      : `hsl(${hue},60%,85%)`;
  };
  const cellStyle = (pct?: number) => ({
    backgroundColor:
      pct === undefined ? 'var(--rt-empty-cell-background)' : pctToColor(pct),
  });
  const hl = { filter: 'brightness(90%)' } as const;
  const abxCol = { whiteSpace: 'nowrap', width: '1%' } as const;

  // ---------- render helpers ----------
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

  const renderTable = (
    mode: 'full' | 'compact' | 'superCompact',
    ref: React.RefObject<HTMLTableElement> | null,
    ghost = false,
  ) => {
    const interactive = !ghost;
    const headers = cols.map((c, i) =>
      mode === 'superCompact'
        ? { text: `[${i + 1}]`, title: c.name }
        : mode === 'compact'
        ? { text: c.short, title: c.name }
        : { text: c.name, title: undefined },
    );

    return (
      <table
        ref={ref}
        className={styles.resistanceTable}
        style={{ borderCollapse: 'separate', borderSpacing: 0 }}
        onMouseOver={interactive ? handleMouseOver : undefined}
        onMouseLeave={interactive ? handleMouseLeave : undefined}
      >
        <thead>
          <tr>
            <th style={abxCol}></th>
            {headers.map((h, colIdx) => (
              <th
                key={colIdx}
                style={{
                  cursor: h.title ? 'help' : 'default',
                  ...(interactive && hoverCol === colIdx ? hl : {}),
                }}
              >
                {h.title ? (
                  <Tip label={h.title} styles={styles}>
                    <span className={styles.fullCellTrigger}>{h.text}</span>
                  </Tip>
                ) : (
                  h.text
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr key={row.rowLong}>
              <td
                style={{
                  ...abxCol,
                  ...(interactive && hoverRow === rowIdx ? hl : {}),
                }}
              >
                {mode === 'full' ? (
                  row.rowLong
                ) : (
                  <Tip label={row.rowLong} styles={styles}>
                    <span className={styles.fullCellTrigger}>{row.rowShort}</span>
                  </Tip>
                )}
              </td>
              {cols.map((c, colIdx) => {
                const cell = row[c.name];
                const highlight = interactive && (hoverRow === rowIdx || hoverCol === colIdx);
                return (
                  <td
                    key={c.id}
                    style={{
                      ...cellStyle(cell?.pct),
                      ...(highlight ? hl : {}),
                    }}
                  >
                    {interactive ? (
                      <Tip
                        label={
                          <CellTooltipContent
                            row={row}
                            col={c}
                            cell={cell}
                            rowsAreAbx={rowsAreAbx}
                          />
                        }
                        styles={styles}
                      >
                        <span className={styles.fullCellTrigger}>
                          {cell ? cell.text : '—'}
                        </span>
                      </Tip>
                    ) : (
                      <span>{cell ? cell.text : '—'}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
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
          {renderTable('full', fullRef, true)}
          {renderTable('compact', compactRef, true)}
          {renderTable('superCompact', superRef, true)}
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
              <li>
                Antibiotics: {p.abx || 'all'}
              </li>
              <li>
                Organisms: {p.org || 'all'}
              </li>
            </ul>
          </div>
        ) : (
          ready && (
            <div className={styles.tableContainer}>
              {renderTable(display, null, false)}
              {(display === 'compact' || display === 'superCompact') && (
                <div className={styles.legend}>
                  {cols.map((c, i) => (
                    <span key={c.id}>
                      <b>{display === 'superCompact' ? `[${i + 1}]` : c.short}:</b> {c.name}
                      {i < cols.length - 1 && '; '}
                    </span>
                  ))}
                </div>
              )}
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
    </RadixTooltip.Provider>
  );
}