/**
 * This file contains pure data processing functions that are not React components
 * and do not rely on React hooks.
 */

// ============================================================================
// Styling Helpers
// ============================================================================

export const pctToColor = (pct, colorMode) => {
  // Defines a clinical color scheme with smooth transitions based on thresholds.
  // 0-5%: Dark green to standard green.
  // 5-20%: Green, transitioning smoothly through yellow to red.
  // >=20%: Red, darkening as resistance increases.
  const light = { saturation: 70, baseLightness: 85 };
  const dark = { saturation: 50, baseLightness: 30 };
  const { saturation, baseLightness } = colorMode === 'dark' ? dark : light;

  // Helper for linear interpolation
  const lerp = (start, end, t) => start * (1 - t) + end * t;

  if (pct < 5) {
    // Range 1: 0% to 5% (Dark Green to Green)
    // Interpolate lightness from a darker shade to the base lightness.
    const t = pct / 5; // Progress within this range (0.0 to 1.0)
    const lightness = lerp(baseLightness - 20, baseLightness, t);
    return `hsl(120, ${saturation}%, ${lightness}%)`;
  }

  if (pct < 20) {
    // Range 2: 5% to 20% (Green -> Yellow -> Red)
    // Interpolate hue from Green (120) to Red (0).
    const t = (pct - 5) / (20 - 5); // Progress within this range (0.0 to 1.0)
    const hue = lerp(120, 0, t);
    return `hsl(${hue}, ${saturation}%, ${baseLightness}%)`;
  }

  // Range 3: 20% to 100% (Red to Dark Red)
  // Interpolate lightness from the base lightness down to a very dark shade.
  const t = Math.min(1, (pct - 20) / (100 - 20)); // Progress, capped at 1.0
  // Increased the minimum lightness in light mode for better text readability.
  const minLightness = colorMode === 'dark' ? 10 : 55;
  const lightness = lerp(baseLightness, minLightness, t);
  return `hsl(0, ${saturation}%, ${lightness}%)`;
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
      if (cell) {
        const isIntrinsic = parseFloat(cell.resistance_pct) === 100 && parseInt(cell.n_isolates, 10) === 0;
        row[c.name] = {
          displayText: isIntrinsic ? 'R' : `${cell.resistance_pct}%`,
          isIntrinsic,
          n: cell.n_isolates,
          pct: parseFloat(cell.resistance_pct),
          source_id: cell.source_id,
        };
      } else {
        row[c.name] = undefined;
      }
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
