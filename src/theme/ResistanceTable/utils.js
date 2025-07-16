/**
 * This file contains pure data processing functions that are not React components
 * and do not rely on React hooks.
 */

import escapeStringRegexp from 'escape-string-regexp';

// ============================================================================
// Styling Helpers
// ============================================================================

export const pctToColor = (pct, colorMode) => {
  const hue = Math.round((1 - pct / 100) * 120);
  return colorMode === 'dark'
    ? `hsl(${hue},40%,30%)`
    : `hsl(${hue},60%,85%)`;
};

export const cellStyle = (pct, colorMode) => ({
  backgroundColor:
    pct === undefined
      ? 'var(--rt-empty-cell-background)'
      : pctToColor(pct, colorMode),
});

export const hl = { filter: 'brightness(90%)' };


// ============================================================================
// Data Processing functions
// ============================================================================

export const parseParams = (s) =>
  s
    .trim()
    .split(/\s+/)
    .reduce((acc, part) => {
      const [k, v] = part.split('=');
      acc[k] = v;
      return acc;
    }, {});

export const escapeRegExp = (str) => escapeStringRegexp(str);

export const resolveIds = (
  param,
  allIds,
  synMap,
  pageText,
) => {
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
  );
};

export const buildMatrix = (
  rowIds,
  colIds,
  rowsAreAbx,
  resistanceData,
) => {
  const m = new Map();
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
      m.get(rowId).set(colId, r);
    });
  return m;
};

export const formatMatrix = (
  matrix,
  rowIds,
  colIds,
  id2Main,
  id2Short,
) => {
  const cols = colIds.map((id) => ({
    id,
    name: id2Main.get(id) ?? id,
    short: id2Short.get(id) ?? id,
  }));

  const data = rowIds.map((rowId) => {
    const row = {
      rowLong: id2Main.get(rowId) ?? rowId,
      rowShort: id2Short.get(rowId) ?? id2Main.get(rowId) ?? rowId,
    };
    cols.forEach((c) => {
      const cell = matrix.get(rowId)?.get(c.id);
      row[c.name] = cell
        ? { text: `${cell.resistance_pct}% (n=${cell.n_isolates})`, pct: parseFloat(cell.resistance_pct) }
        : undefined;
    });
    return row;
  });
  return { data, cols };
};

/**
 * Determines the background color of a cell based on resistance percentage.
 */
export const getCellStyle = (
  resistance,
  colorMode,
) => {
  if (resistance === undefined || resistance === null) {
    return {};
  }

  const baseColors = {
    sensitive: 'var(--ifm-color-success-light)',
    intermediate: 'var(--ifm-color-warning-light)',
    resistant: 'var(--ifm-color-danger-light)',
  };

  let backgroundColor = 'transparent';
  if (resistance <= 25) {
    backgroundColor = baseColors.sensitive;
  } else if (resistance <= 75) {
    backgroundColor = baseColors.intermediate;
  } else {
    backgroundColor = baseColors.resistant;
  }

  return { backgroundColor };
};

/**
 * Returns the style for a highlighted row or column.
 */
export const getHighlightStyle = (
  colorMode,
) => ({
  backgroundColor:
    colorMode === 'dark'
      ? 'var(--ifm-hover-overlay)'
      : 'rgba(0, 0, 0, 0.05)',
});
