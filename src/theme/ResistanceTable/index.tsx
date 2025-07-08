import { useColorMode } from '@docusaurus/theme-common';
import { usePluginData } from '@docusaurus/useGlobalData';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './styles.module.css';

// ============================================================================
// Helper functions for data processing
// ============================================================================

/** Parse a space‑separated parameter string (e.g. "abx=auto org=all") */
const parseParams = (s: string): Record<string, string> =>
  s.trim().split(/\s+/).reduce((acc: Record<string, string>, part) => {
    const [k, v] = part.split('=');
    acc[k] = v;
    return acc;
  }, {});

/** Escape text so it can be inserted literally into a RegExp. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – older TS libs may lack RegExp.escape
const escapeRegExp = (str: string): string =>
  typeof RegExp.escape === 'function'
    ? RegExp.escape(str)
    : str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Resolve a list of antibiotic / organism IDs from a user parameter.
 * Modes: "auto" | "all" | comma‑separated list. Matching is
 * case‑insensitive for IDs and synonyms.
 */
const resolveIds = (
  param: string | undefined,
  allIds: string[],
  synMap: Record<string, string>,
  pageText: string,
): string[] => {
  const synLower: Record<string, string> = Object.fromEntries(
    Object.entries(synMap).map(([k, v]) => [k.toLowerCase(), v]),
  );

  // ---------- AUTO mode ----------
  if (param === 'auto') {
    const lower = pageText.toLowerCase();
    const wordSet = new Set(lower.match(/[a-z0-9]+/g) || []);

    const detected = Object.keys(synLower)
      .filter((syn) => {
        if (syn.includes(' ')) {
          // multi‑word synonym → regex with word boundaries
          return new RegExp(`\\b${escapeRegExp(syn)}\\b`, 'i').test(pageText);
        }
        // single word synonym → token lookup (fast, robust)
        return wordSet.has(syn);
      })
      .map((syn) => synLower[syn]);

    return [...new Set(detected)];
  }

  // ---------- ALL mode ----------
  if (!param || param === 'all') return allIds;

  // ---------- explicit CSV ----------
  return Array.from(
    new Set(
      param
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => {
          const upper = t.toUpperCase();
          if (allIds.includes(upper)) return upper;
          return synLower[t.toLowerCase()] ?? null;
        })
        .filter(Boolean),
    ),
  ) as string[];
};

/** Build a nested Map matrix of resistance data for quick lookup. */
const buildMatrix = (
  rowIds: string[],
  colIds: string[],
  rowsAreAbx: boolean,
  resistanceData: any[],
) => {
  const m = new Map<string, Map<string, any>>();
  rowIds.forEach((id) => m.set(id, new Map()));
  resistanceData
    .filter((r) => {
      const abxId = rowsAreAbx ? r.antibiotic_id : r.organism_id;
      const orgId = rowsAreAbx ? r.organism_id : r.antibiotic_id;
      return rowIds.includes(abxId) && colIds.includes(orgId);
    })
    .forEach((r) => {
      const rowId = rowsAreAbx ? r.antibiotic_id : r.organism_id;
      const colId = rowsAreAbx ? r.organism_id : r.antibiotic_id;
      m.get(rowId)!.set(colId, r);
    });
  return m;
};

/** Convert matrix into table‑friendly structures. */
const formatMatrix = (
  matrix: Map<string, Map<string, any>>,
  rowIds: string[],
  colIds: string[],
  id2Main: Map<string, string>,
  id2Short: Map<string, string>,
) => {
  const cols = colIds.map((id) => ({
    id,
    name: id2Main.get(id) ?? id,
    short: id2Short.get(id) ?? id,
  }));

  const data = rowIds.map((rowId) => {
    const row: Record<string, any> = {
      rowLong: id2Main.get(rowId) ?? rowId,
      rowShort: id2Short.get(rowId) ?? id2Main.get(rowId) ?? rowId,
    };
    cols.forEach((c) => {
      const cell = matrix.get(rowId)?.get(c.id);
      row[c.name] = cell
        ? { text: `${cell.resistance_pct}% (${cell.n_isolates})`, pct: cell.resistance_pct }
        : { text: '—', pct: undefined };
    });
    return row;
  });
  return { data, cols };
};

// ============================================================================
// UI components
// ============================================================================

const SourceSwitcher = ({
  sources,
  selected,
  onSelect,
}: {
  sources: any[];
  selected: any;
  onSelect: (s: any) => void;
}) => {
  if (sources.length <= 1) {
    return null;
  }
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className={styles.specimenTrigger}>
          <span className={styles.specimenTriggerInner}>
            <span>Source: {selected.short_name}</span>
            <ChevronDownIcon className={styles.specimenChevron} aria-hidden />
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.specimenContent} sideOffset={5}>
          {sources.map((s) => (
            <DropdownMenu.Item
              key={s.file}
              className={styles.specimenItem}
              onSelect={() => onSelect(s)}
            >
              {s.short_name}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

const Tip = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <RadixTooltip.Root delayDuration={0}>
    <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        sideOffset={4}
        className={styles.tooltipContent}
      >
        {label}
        <RadixTooltip.Arrow width={8} height={4} className={styles.tooltipArrow} />
      </RadixTooltip.Content>
    </RadixTooltip.Portal>
  </RadixTooltip.Root>
);

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
  const pageText = JSON.parse(pageTextJson);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullRef = useRef<HTMLTableElement>(null);
  const compactRef = useRef<HTMLTableElement>(null);
  const superRef = useRef<HTMLTableElement>(null);

  const { colorMode } = useColorMode();

  const p = parseParams(paramString);
  const [showEmpty, setShowEmpty] = useState(p.showEmpty === 'true');

  const [display, setDisplay] =
    useState<'full' | 'compact' | 'superCompact'>('full');
  const [ready, setReady] = useState(false);
  const [hoverRow, setHoverRow] = useState<number | null>(null);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [selectedSource, setSelectedSource] = useState<any>(null);

  const gd: any = usePluginData(
    'docusaurus-plugin-resistogram',
    'example-resistogram',
  );

  const chooseMode = () => {
    const w = containerRef.current?.offsetWidth ?? 0;
    if (!w) return;
    if (fullRef.current && fullRef.current.scrollWidth <= w) setDisplay('full');
    else if (compactRef.current && compactRef.current.scrollWidth <= w)
      setDisplay('compact');
    else setDisplay('superCompact');
  };

  useEffect(() => {
    if (gd?.sources?.length) {
      setSelectedSource(gd.sources[0]);
    }
  }, [gd?.sources]);

  useEffect(() => {
    setShowEmpty(p.showEmpty === 'true');
  }, [paramString]);

  useLayoutEffect(() => {
    if (fullRef.current && compactRef.current && superRef.current) {
      chooseMode();
      if (!ready) {
        setReady(true);
      }
    }
  }, [selectedSource, ready, showEmpty]);

  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const ro = new ResizeObserver(chooseMode);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [ready]);

  if (!gd) {
    return <div className={styles.error}>Error: plugin data not found.</div>;
  }

  if (!selectedSource) {
    return <div className={styles.error}>No data source selected or available.</div>;
  }
  
  const id2Main = new Map<string, string>(Object.entries(gd.id2MainSyn));
  const id2Short = new Map<string, string>(Object.entries(gd.id2ShortName));

  const abxIds = resolveIds(p.abx, gd.allAbxIds, gd.abxSyn2Id, pageText);
  const orgIds = resolveIds(p.org, gd.allOrgIds, gd.orgSyn2Id, pageText);
  
  const resistanceData = gd.resistanceData[selectedSource.file];

  if (!resistanceData) {
    return <div className={styles.error}>No data found for source: {selectedSource.short_name}</div>;
  }

  // ---------------- layout and filtering logic ----------------
  let rowIds = abxIds;
  let colIds = orgIds;
  let rowsAreAbx = true;
  const layout = p.layout || 'auto';

  if (layout === 'organisms-rows') {
    rowIds = orgIds;
    colIds = abxIds;
    rowsAreAbx = false;
  } else if (layout === 'auto') {
    if (orgIds.length > 4 && abxIds.length > 0 && orgIds.length / abxIds.length > 2) {
      rowIds = orgIds;
      colIds = abxIds;
      rowsAreAbx = false;
    }
  }

  const matrix = buildMatrix(rowIds, colIds, rowsAreAbx, resistanceData);

  const emptyRowIds = rowIds.filter(id => matrix.get(id)?.size === 0);
  const nonEmptyColIds = new Set<string>();
  matrix.forEach(colMap => {
    colMap.forEach((_value, colId) => nonEmptyColIds.add(colId));
  });
  const emptyColIds = colIds.filter(id => !nonEmptyColIds.has(id));

  const hiddenRowCount = emptyRowIds.length;
  const hiddenColCount = emptyColIds.length;

  const finalRowIds = showEmpty ? rowIds : rowIds.filter(id => !emptyRowIds.includes(id));
  const finalColIds = showEmpty ? colIds : colIds.filter(id => !emptyColIds.includes(id));

  const { data, cols } = formatMatrix(
    matrix,
    finalRowIds,
    finalColIds,
    id2Main,
    id2Short,
  );

  if (!data.length) {
    const formatParamList = (param: string, ids: string[]): string => {
      if (!param || param === 'all') return 'all';
      if (param === 'auto') {
        if (ids.length === 0) return 'none detected in page text';
      }
      // For 'auto' with detections and for explicit lists, show the resolved names.
      return ids.map(id => id2Main.get(id) || id).join(', ');
    };

    const abxParam = p.abx || 'all';
    const orgParam = p.org || 'all';

    return (
      <RadixTooltip.Provider delayDuration={0}>
        <div ref={containerRef}>
          <SourceSwitcher
            sources={gd.sources}
            selected={selectedSource}
            onSelect={setSelectedSource}
          />
          <div className={styles.tableContainer}>
            <div className={styles.noDataContainer}>
              <p>
                <strong>Resistance Table</strong>
              </p>
              <p>No matching resistance data found in this source.</p>
              <p>The query parameters were:</p>
              <ul>
                <li>
                  Antibiotics: {formatParamList(abxParam, abxIds)}
                </li>
                <li>
                  Organisms: {formatParamList(orgParam, orgIds)}
                </li>
              </ul>
            </div>
            <div className={styles.sourceInfo}>
              Source: <a href={selectedSource.url} target="_blank" rel="noopener noreferrer">{selectedSource.long_name}</a>
            </div>
          </div>
        </div>
      </RadixTooltip.Provider>
    );
  }

  // ---------------- styling helpers ----------------
  const pctToColor = (pct: number) => {
    const hue = Math.round((1 - pct / 100) * 120);
    if (colorMode === 'dark') {
      return `hsl(${hue}, 40%, 30%)`;
    }
    return `hsl(${hue}, 60%, 85%)`;
  };
  const cellStyle = (pct: number | undefined) =>
    pct === undefined
      ? { backgroundColor: 'var(--rt-empty-cell-background)' }
      : { backgroundColor: pctToColor(pct) };
  const hlStyle = { filter: 'brightness(90%)' };
  const abxColBase = { whiteSpace: 'nowrap', width: '1%' } as const;

  // ---------------- render helpers ----------------
  const renderHiddenCount = () => {
    const rowLabel = rowsAreAbx ? 'antibiotic' : 'organism';
    const colLabel = rowsAreAbx ? 'organism' : 'antibiotic';
    const parts = [];
    if (hiddenRowCount > 0) {
      parts.push(`${hiddenRowCount} ${rowLabel}${hiddenRowCount > 1 ? 's' : ''}`);
    }
    if (hiddenColCount > 0) {
      parts.push(`${hiddenColCount} ${colLabel}${hiddenColCount > 1 ? 's' : ''}`);
    }
    if (parts.length === 0) return null;

    const text = showEmpty ? ' with no data' : ' hidden';
    const linkText = showEmpty ? 'hide' : 'show';

    return (
      <div>
        {parts.join(' and ')}
        {text} (<a href="#" onClick={(e) => { e.preventDefault(); setShowEmpty(!showEmpty); }}>{linkText}</a>)
      </div>
    );
  };

  // ---------------- table renderer ----------------
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
      >
        <thead>
          <tr>
            <th style={{ ...abxColBase }}></th>
            {headers.map((h, colIdx) => (
              <th
                key={colIdx}
                style={{
                  cursor: h.title ? 'help' : 'default',
                  ...(interactive && hoverCol === colIdx ? hlStyle : {}),
                }}
                onMouseEnter={
                  interactive ? () => setHoverCol(colIdx) : undefined
                }
                onMouseLeave={
                  interactive ? () => setHoverCol(null) : undefined
                }
              >
                {h.title ? (
                  <Tip label={h.title}>
                    <span>{h.text}</span>
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
                  ...abxColBase,
                  ...(interactive && hoverRow === rowIdx ? hlStyle : {}),
                }}
                onMouseEnter={
                  interactive ? () => setHoverRow(rowIdx) : undefined
                }
                onMouseLeave={
                  interactive ? () => setHoverRow(null) : undefined
                }
              >
                {mode === 'full' ? (
                  row.rowLong
                ) : (
                  <Tip label={row.rowLong}>
                    <span>{row.rowShort}</span>
                  </Tip>
                )}
              </td>
              {cols.map((c, colIdx) => {
                const cell = row[c.name];
                const highlight =
                  interactive &&
                  (hoverRow === rowIdx || hoverCol === colIdx);
                return (
                  <td
                    key={c.id}
                    style={{
                      ...cellStyle(cell?.pct),
                      ...(highlight ? hlStyle : {}),
                    }}
                    onMouseEnter={
                      interactive
                        ? () => {
                            setHoverRow(rowIdx);
                            setHoverCol(colIdx);
                          }
                        : undefined
                    }
                    onMouseLeave={
                      interactive
                        ? () => {
                            setHoverRow(null);
                            setHoverCol(null);
                          }
                        : undefined
                    }
                  >
                    {cell ? cell.text : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  // ---------------- JSX ----------------
  return (
    <RadixTooltip.Provider delayDuration={0}>
      <div ref={containerRef}>
        <SourceSwitcher
          sources={gd.sources}
          selected={selectedSource}
          onSelect={setSelectedSource}
        />
        {/* ghost tables for width measurement */}
        <div style={{ visibility: 'hidden', height: 0, overflow: 'hidden' }}>
          {renderTable('full', fullRef, true)}
          {renderTable('compact', compactRef, true)}
          {renderTable('superCompact', superRef, true)}
        </div>
        {/* visible table and legend */}
        {ready && (
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
              {renderHiddenCount()}
              Source: <a href={selectedSource.url} target="_blank" rel="noopener noreferrer">{selectedSource.long_name}</a>
            </div>
          </div>
        )}
      </div>
    </RadixTooltip.Provider>
  );
}