import { useColorMode } from '@docusaurus/theme-common';
import { usePluginData } from '@docusaurus/useGlobalData';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import styles from './styles.module.css';

// ============================================================================
// Helper functions
// ============================================================================

const parseParams = (s: string): Record<string, string> =>
s
.trim()
.split(/\s+/)
.reduce((acc: Record<string, string>, part) => {
  const [k, v] = part.split('=');
  acc[k] = v;
  return acc;
}, {});

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const escapeRegExp = (str: string): string =>
typeof RegExp.escape === 'function'
? RegExp.escape(str)
: str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const resolveIds = (
  param: string | undefined,
  allIds: string[],
  synMap: Record<string, string>,
  pageText: string,
): string[] => {
  const synLower = Object.fromEntries(
    Object.entries(synMap).map(([k, v]) => [k.toLowerCase(), v]),
  );

  if (param === 'auto') {
    const lower = pageText.toLowerCase();
    const wordSet = new Set(lower.match(/[a-z0-9]+/g) ?? []);

    const detected = Object.keys(synLower)
    .filter((syn) =>
    syn.includes(' ')
    ? new RegExp(`\\b${escapeRegExp(syn)}\\b`, 'i').test(pageText)
    : wordSet.has(syn),
    )
    .map((syn) => synLower[syn]);

    return [...new Set(detected)];
  }

  if (!param || param === 'all') return allIds;

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
// UI helpers (SourceSwitcher, Tip, CellTooltipContent)
// ============================================================================

const SourceSwitcher = ({
  sources,
  selected,
  onSelect,
}: {
  sources: any[];
  selected: any;
  onSelect: (s: any) => void;
}) =>
sources.length <= 1 ? null : (
  <DropdownMenu.Root>
  <DropdownMenu.Trigger asChild>
  <button className={styles.specimenTrigger}>
  <span className={styles.specimenTriggerInner}>
  <span>Source: {selected?.short_name ?? '—'}</span>
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

const Tip = ({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) => (
  <RadixTooltip.Root delayDuration={0}>
  <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
  <RadixTooltip.Portal>
  <RadixTooltip.Content sideOffset={4} className={styles.tooltipContent}>
  {label}
  <RadixTooltip.Arrow width={8} height={4} className={styles.tooltipArrow} />
  </RadixTooltip.Content>
  </RadixTooltip.Portal>
  </RadixTooltip.Root>
);

const CellTooltipContent = ({
  row,
  col,
  cell,
  rowsAreAbx,
}: {
  row: any;
  col: any;
  cell: any;
  rowsAreAbx: boolean;
}) => {
  const rowLabel = rowsAreAbx ? 'Antibiotic' : 'Organism';
  const colLabel = rowsAreAbx ? 'Organism' : 'Antibiotic';
  return (
    <div style={{ textAlign: 'left' }}>
    <div><strong>{rowLabel}:</strong> {row.rowLong}</div>
    <div><strong>{colLabel}:</strong> {col.name}</div>
    {cell.text !== '—' && (
      <div style={{ marginTop: 4 }}>
      <strong>Resistance:</strong> {cell.text}
      </div>
    )}
    </div>
  );
};

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
  const p = parseParams(paramString);

  const [showEmpty, setShowEmpty] = useState(p.showEmpty === 'true');
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

  const gd: any = usePluginData(
    'docusaurus-plugin-resistogram',
    'example-resistogram',
  );

  // ---------- derived (memoised) data ----------
  const sources = gd?.sources ?? [];

  /* pick first source once */
  useEffect(() => {
    if (!selectedSource && sources.length) setSelectedSource(sources[0]);
  }, [sources, selectedSource]);

    /* update showEmpty on param change */
    useEffect(() => setShowEmpty(p.showEmpty === 'true'), [paramString]);

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

      // safe fallbacks
      const id2Main = useMemo(
        () => new Map<string, string>(Object.entries(gd?.id2MainSyn ?? {})),
                              [gd],
      );
      const id2Short = useMemo(
        () => new Map<string, string>(Object.entries(gd?.id2ShortName ?? {})),
                               [gd],
      );

      const abxIds = useMemo(
        () =>
        resolveIds(
          p.abx,
          gd?.allAbxIds ?? [],
          gd?.abxSyn2Id ?? {},
          pageText,
        ),
        [p.abx, gd, pageText],
      );
      const orgIds = useMemo(
        () =>
        resolveIds(
          p.org,
          gd?.allOrgIds ?? [],
          gd?.orgSyn2Id ?? {},
          pageText,
        ),
        [p.org, gd, pageText],
      );

      const resistanceData = useMemo(
        () =>
        selectedSource && gd?.resistanceData
        ? gd.resistanceData[selectedSource.file] ?? []
        : [],
        [selectedSource, gd],
      );

      // layout switch
      const { rowIds, colIds, rowsAreAbx } = useMemo(() => {
        const autoLayout =
        p.layout === 'auto' || !p.layout ? 'auto' : p.layout;
        let rIds = abxIds;
        let cIds = orgIds;
        let rAreAbx = true;

        if (autoLayout === 'organisms-rows') {
          rIds = orgIds;
          cIds = abxIds;
          rAreAbx = false;
        } else if (autoLayout === 'auto') {
          if (orgIds.length > 4 && abxIds.length && orgIds.length / abxIds.length > 2) {
            rIds = orgIds;
            cIds = abxIds;
            rAreAbx = false;
          }
        }
        return { rowIds: rIds, colIds: cIds, rowsAreAbx: rAreAbx };
      }, [p.layout, abxIds, orgIds]);

      const matrix = useMemo(
        () => buildMatrix(rowIds, colIds, rowsAreAbx, resistanceData),
                             [rowIds, colIds, rowsAreAbx, resistanceData],
      );

      const { emptyRowIds, emptyColIds } = useMemo(() => {
        const emptyRows = rowIds.filter((id) => matrix.get(id)?.size === 0);
        const nonEmptyCols = new Set<string>();
        matrix.forEach((colMap) => colMap.forEach((_v, cId) => nonEmptyCols.add(cId)));
        const emptyCols = colIds.filter((id) => !nonEmptyCols.has(id));
        return { emptyRowIds: emptyRows, emptyColIds: emptyCols };
      }, [matrix, rowIds, colIds]);

      const finalRowIds = showEmpty ? rowIds : rowIds.filter((id) => !emptyRowIds.includes(id));
      const finalColIds = showEmpty ? colIds : colIds.filter((id) => !emptyColIds.includes(id));

      const { data, cols } = useMemo(
        () => formatMatrix(matrix, finalRowIds, finalColIds, id2Main, id2Short),
                                     [matrix, finalRowIds, finalColIds, id2Main, id2Short],
      );

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
              <Tip label={h.title}>
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
              <Tip label={row.rowLong}>
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
      if (!gd) {
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
        ) : !data.length ? (
          <div className={styles.error}>No matching resistance data.</div>
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
