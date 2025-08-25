/**
 * This file contains pure data processing functions that are not React components
 * and do not rely on React hooks.
 */

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

const getLocalizedName = (id, names, locale) => {
  const nameObj = names.get(id);
  if (!nameObj) return id;
  return nameObj[`name_${locale}`] || nameObj.name_en || id;
};

export const formatMatrix = (
  matrix,
  rowIds,
  colIds,
  id2Main,
  id2Short,
  locale,
) => {
  const cols = colIds.map((id) => ({
    id,
    name: getLocalizedName(id, id2Main, locale),
    short: getLocalizedName(id, id2Short, locale),
  }));

  const data = rowIds.map((rowId) => {
    const row = {
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
  idsToShow,
  allOriginalIds,
  classToAbx,
) => {
  const finalOrder = [];
  const idsToShowSet = new Set(idsToShow);
  const processed = new Set();

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
