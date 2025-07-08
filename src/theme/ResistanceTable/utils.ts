/**
 * This file contains pure data processing functions that are not React components
 * and do not rely on React hooks.
 */

// ============================================================================
// Styling Helpers
// ============================================================================

export const pctToColor = (pct: number, colorMode: 'dark' | 'light') => {
  const hue = Math.round((1 - pct / 100) * 120);
  return colorMode === 'dark'
    ? `hsl(${hue},40%,30%)`
    : `hsl(${hue},60%,85%)`;
};

export const cellStyle = (pct: number | undefined, colorMode: 'dark' | 'light') => ({
  backgroundColor:
    pct === undefined
      ? 'var(--rt-empty-cell-background)'
      : pctToColor(pct, colorMode),
});

export const hl = { filter: 'brightness(90%)' } as const;


// ============================================================================
// Data Processing functions
// ============================================================================

export const parseParams = (s: string): Record<string, string> =>
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
export const escapeRegExp = (str: string): string =>
  typeof RegExp.escape === 'function'
    ? RegExp.escape(str)
    : str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const resolveIds = (
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

export const buildMatrix = (
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

export const formatMatrix = (
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