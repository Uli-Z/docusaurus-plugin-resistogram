import { Locale } from './i18n';

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

const getLocalizedName = (id: string, names: Map<string, any>, locale: Locale) => {
  const nameObj = names.get(id);
  if (!nameObj) return id;
  return nameObj[`name_${locale}`] || nameObj.name_en || id;
};

export const formatMatrix = (
  matrix: Map<string, Map<string, any>>,
  rowIds: string[],
  colIds: string[],
  id2Main: Map<string, any>,
  id2Short: Map<string, any>,
  locale: Locale,
) => {
  const cols = colIds.map((id) => ({
    id,
    name: getLocalizedName(id, id2Main, locale),
    short: getLocalizedName(id, id2Short, locale),
  }));

  const data = rowIds.map((rowId) => {
    const row: Record<string, any> = {
      rowLong: getLocalizedName(rowId, id2Main, locale),
      rowShort: getLocalizedName(rowId, id2Short, locale) ?? getLocalizedName(rowId, id2Main, locale),
    };
    cols.forEach((c) => {
      const cell = matrix.get(rowId)?.get(c.id);
      row[c.name] = cell
        ? { text: `${cell.resistance_pct}% (n=${cell.n_isolates})`, pct: parseFloat(cell.resistance_pct), source_id: cell.source_id }
        : undefined;
    });
    return row;
  });
  return { data, cols };
};

export const groupAndSortAntibiotics = (
  idsToShow: string[],
  allOriginalIds: string[],
  classToAbx: Map<string, string[]>,
) => {
  const finalOrder: string[] = [];
  const idsToShowSet = new Set(idsToShow);
  const processed = new Set<string>();

  for (const id of allOriginalIds) {
    if (processed.has(id)) {
      continue;
    }

    const isClass = classToAbx.has(id);

    if (isClass) {
      const members = classToAbx.get(id) ?? [];
      // Don't add the class itself to the final list, just its members.
      // Process the class so we don't handle its members individually later.
      processed.add(id);

      for (const memberId of members) {
        if (idsToShowSet.has(memberId) && !processed.has(memberId)) {
          finalOrder.push(memberId);
          processed.add(memberId);
        }
      }
    } else {
      // It's an antibiotic. Add it if it's in the show list.
      if (idsToShowSet.has(id)) {
        finalOrder.push(id);
        processed.add(id);
      }
    }
  }
  return finalOrder;
};