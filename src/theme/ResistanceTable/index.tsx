import React, {
  useState,
  useLayoutEffect,
  useEffect,
  useRef,
} from 'react';
import { usePluginData } from '@docusaurus/useGlobalData';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import styles from './styles.module.css';

// ============================================================================
// Helper-Funktionen zur Datenverarbeitung
// ============================================================================

/**
 * Parst einen String von Parametern (z.B. "abx=auto org=all")
 * in ein Schlüssel-Wert-Objekt.
 * @param {string} s Der zu parsende String.
 * @returns {Object} Ein Objekt mit den geparsten Parametern.
 */
const parseParams = (s) =>
  s.trim().split(/\s+/).reduce((acc, part) => {
    const [k, v] = part.split('=');
    acc[k] = v;
    return acc;
  }, {});

/**
 * Löst eine Liste von Antibiotika- oder Organismus-IDs basierend auf einem Parameter auf.
 * @param {string} param Der Parameterwert ('auto', 'all' oder eine kommaseparierte Liste).
 * @param {string[]} allIds Eine Liste aller verfügbaren IDs für diesen Typ.
 * @param {Object} synMap Eine Map von Synonymen zu IDs.
 * @param {string} pageText Der gesamte Text der aktuellen Seite (für den 'auto'-Modus).
 * @returns {string[]} Eine eindeutige Liste der aufgelösten IDs.
 */
const resolveIds = (param, allIds, synMap, pageText) => {
  // Debug-Ausgabe für die übergebene Synonym-Map
  console.log(`[resolveIds] Using synMap for param "${param}":`, synMap);

  // Case 1: 'auto' - Detect synonyms from the page text
  if (param === 'auto') {
    const text = pageText.toLowerCase();
    const detected = Object.keys(synMap)
      .filter((syn) => {
        // Erstellt einen regulären Ausdruck, um das Synonym als ganzes Wort zu finden.
        // Spezielle Regex-Zeichen im Synonym werden escaped.
        const searchSyn = syn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${searchSyn}\\b`, 'i');
        return regex.test(text);
      })
      .map((syn) => synMap[syn]);
    // Gibt eine eindeutige Liste der erkannten IDs zurück.
    return [...new Set(detected)];
  }

  // Fall 2: 'all' oder leer -> Gibt alle verfügbaren IDs zurück.
  if (!param || param === 'all') {
    return allIds;
  }

  // Fall 3: Spezifische Liste von IDs/Synonymen.
  return Array.from(
    new Set(
      param
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .map((t) => {
          // Prüft, ob der Begriff eine direkte ID ist (Groß-/Kleinschreibung ignorieren).
          const upperT = t.toUpperCase();
          if (allIds.includes(upperT)) {
            return upperT;
          }
          // Andernfalls prüfen, ob es ein Synonym ist.
          return synMap[t] || null;
        })
        .filter(Boolean) // Filtert alle null-Werte von nicht gefundenen Übereinstimmungen heraus.
    )
  );
};

/**
 * Erstellt eine verschachtelte Map (Matrix) der Resistenzdaten für einen schnellen Zugriff.
 * @param {string[]} abxIds Die zu inkludierenden Antibiotika-IDs.
 * @param {string[]} orgIds Die zu inkludierenden Organismus-IDs.
 * @param {string} specimen Das ausgewählte Probenmaterial ('auto' oder ein spezifischer Typ).
 * @param {Object[]} rows Die rohen Resistenzdaten.
 * @returns {Map<string, Map<string, Object>>} Eine Map, die abxId -> orgId -> Resistenz-Datenpunkt abbildet.
 */
const buildMatrix = (abxIds, orgIds, specimen, rows) => {
  const m = new Map();
  abxIds.forEach((id) => m.set(id, new Map()));
  rows
    .filter(
      (r) =>
        abxIds.includes(r.antibiotic_id) &&
        orgIds.includes(r.organism_id) &&
        (!specimen || specimen === 'auto' || r.specimen === specimen),
    )
    .forEach((r) => m.get(r.antibiotic_id).set(r.organism_id, r));
  return m;
};

/**
 * Formatiert die Datenmatrix in ein für die Tabellenanzeige geeignetes Format.
 * @param {Map} matrix Die von buildMatrix erstellte Datenmatrix.
 * @param {string[]} abxIds Die Liste der Antibiotika-IDs.
 * @param {string[]} orgIds Die Liste der Organismus-IDs.
 * @param {Map} id2Main Map von ID zu Haupt-Synonym/Langname.
 * @param {Map} id2Short Map von ID zu Kurzname.
 * @returns {{data: Object[], orgs: Object[]}} Die formatierten Daten für die Tabelle.
 */
const formatMatrix = (matrix, abxIds, orgIds, id2Main, id2Short) => {
  const orgs = orgIds.map((id) => ({
    id,
    name: id2Main.get(id) ?? id,
    short: id2Short.get(id) ?? id,
  }));

  const data = abxIds.map((abx) => {
    const longName = id2Main.get(abx) ?? abx;
    const shortName = id2Short.get(abx) ?? longName;
    const row = { antibioticLong: longName, antibioticShort: shortName };

    orgs.forEach((o) => {
      const cell = matrix.get(abx)?.get(o.id);
      if (cell) {
        row[o.name] = {
          text: `${cell.resistance_pct}% (${cell.n_isolates})`,
          pct: cell.resistance_pct,
        };
      } else {
        row[o.name] = { text: '—', pct: undefined };
      }
    });
    return row;
  });

  return { data, orgs };
};

/**
 * Ermittelt die verfügbaren Probenmaterialien (Specimens) basierend auf den ausgewählten IDs.
 * @param {string[]} abxIds Die ausgewählten Antibiotika-IDs.
 * @param {string[]} orgIds Die ausgewählten Organismus-IDs.
 * @param {Object[]} rows Die rohen Resistenzdaten.
 * @returns {string[]} Eine Liste der verfügbaren Probenmaterialien.
 */
const getAvailableSpecimens = (abxIds, orgIds, rows) => {
  const specimens = new Set();
  rows.forEach((r) => {
    if (abxIds.includes(r.antibiotic_id) && orgIds.includes(r.organism_id) && r.specimen) {
      specimens.add(r.specimen);
    }
  });
  return ['auto', ...Array.from(specimens).sort()];
};

// ============================================================================
// UI-Komponenten
// ============================================================================

/**
 * Eine Dropdown-Komponente zur Auswahl des Probenmaterials (Specimen).
 */
const SpecimenSwitcher = ({ available, selected, onSelect }) => {
  // Wenn nur eine Option verfügbar ist, zeige nur Text an.
  if (available.length <= 1) {
    return <div className={styles.specimenDisplay}>Specimen: {selected}</div>;
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className={styles.specimenTrigger}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>Specimen: {selected}</span>
            <ChevronDownIcon className={styles.specimenChevron} aria-hidden />
          </span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.specimenContent} sideOffset={5}>
          {available.map((specimen) => (
            <DropdownMenu.Item
              key={specimen}
              className={styles.specimenItem}
              onSelect={() => onSelect(specimen)}
            >
              {specimen}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

/**
 * Eine Tooltip-Wrapper-Komponente.
 */
const Tip = ({ label, children }) => (
  <RadixTooltip.Root delayDuration={0}>
    <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        sideOffset={4}
        style={{
          backgroundColor: 'rgba(60,60,60,0.9)',
          color: '#fff',
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: '0.75rem',
          whiteSpace: 'nowrap',
          zIndex: 100,
        }}
      >
        {label}
        <RadixTooltip.Arrow width={8} height={4} style={{ fill: 'rgba(60,60,60,0.9)' }} />
      </RadixTooltip.Content>
    </RadixTooltip.Portal>
  </RadixTooltip.Root>
);

// ============================================================================
// Hauptkomponente: ResistanceTable
// ============================================================================
export default function ResistanceTable({ params: paramString, pageText }) {
  // Refs für die verschiedenen Tabellen-Layouts zur Breitenmessung.
  const containerRef = useRef(null);
  const fullRef = useRef(null);
  const compactRef = useRef(null);
  const superRef = useRef(null);

  // State für das dynamische Layout und Interaktionen.
  const [display, setDisplay] = useState('full'); // 'full', 'compact', oder 'superCompact'
  const [ready, setReady] = useState(false); // Wird true, nachdem die unsichtbaren Tabellen gerendert wurden.
  const [hoverRow, setHoverRow] = useState(null);
  const [hoverCol, setHoverCol] = useState(null);
  const [selectedSpecimen, setSelectedSpecimen] = useState('auto');

  // Lädt die globalen Daten, die vom Plugin bereitgestellt werden.
  const gd = usePluginData('docusaurus-plugin-resistogram', 'example-resistogram');
  if (!gd)
    return <div className={styles.error}>Fehler: Plugin-Daten nicht gefunden.</div>;

  // Konvertiert die Datenobjekte in Maps für einen einfacheren Zugriff.
  const abxSyn2Id = new Map(Object.entries(gd.abxSyn2Id));
  const orgSyn2Id = new Map(Object.entries(gd.orgSyn2Id));
  const id2Main = new Map(Object.entries(gd.id2MainSyn));
  const id2Short = new Map(Object.entries(gd.id2ShortName));

  // Verarbeitet die Eingabeparameter und löst die IDs auf.
  const p = parseParams(paramString);
  const abxIds = resolveIds(p.abx, gd.allAbxIds, gd.abxSyn2Id, pageText);
  const orgIds = resolveIds(p.org, gd.allOrgIds, gd.orgSyn2Id, pageText);

  // Debugging-Ausgabe in der Browser-Konsole.
  console.log('ResistanceTable Debug:', {
    params: p,
    resolvedAbx: abxIds,
    resolvedOrg: orgIds,
  });
  
  // Ermittelt die verfügbaren Probenmaterialien basierend auf den ausgewählten IDs.
  const availableSpecimens = getAvailableSpecimens(abxIds, orgIds, gd.resistanceData);

  // Setzt das anfängliche Probenmaterial basierend auf den Parametern.
  useEffect(() => {
    const initialSpecimen = p.specimen || 'auto';
    if (availableSpecimens.includes(initialSpecimen)) {
      setSelectedSpecimen(initialSpecimen);
    } else if (availableSpecimens.length > 0) {
      setSelectedSpecimen(availableSpecimens[0]);
    }
  }, [paramString, gd.resistanceData]);

  // Baut und formatiert die Datenmatrix für die Anzeige.
  const { data, orgs } = formatMatrix(
    buildMatrix(abxIds, orgIds, selectedSpecimen, gd.resistanceData),
    abxIds,
    orgIds,
    id2Main,
    id2Short,
  );

  // ---------- Logik für das dynamische Layout ----------
  // Wählt den besten Anzeigemodus basierend auf der verfügbaren Breite.
  const chooseMode = () => {
    const w = containerRef.current?.offsetWidth ?? 0;
    if (!w) return;
    if (fullRef.current?.scrollWidth <= w) setDisplay('full');
    else if (compactRef.current?.scrollWidth <= w) setDisplay('compact');
    else setDisplay('superCompact');
  };

  // Führt chooseMode aus, nachdem die "Geister"-Tabellen gerendert wurden.
  useLayoutEffect(() => {
    if (!ready && fullRef.current && compactRef.current && superRef.current) {
      setReady(true);
      chooseMode();
    }
  }, [ready]);

  // Beobachtet Größenänderungen des Containers, um das Layout anzupassen.
  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const ro = new ResizeObserver(chooseMode);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [ready]);

  // Zeigt eine Fehlermeldung an, wenn keine Daten gefunden wurden.
  if (!data.length)
    return <div className={styles.error}>Keine passenden Resistenzdaten gefunden.</div>;

  // ---------- Styling-Objekte für die Tabelle ----------
  const pctToColor = (pct) => `hsl(${Math.round((pct / 100) * 120)}, 60%, 85%)`;
  const cellStyle = (pct) =>
    pct === undefined
      ? { backgroundColor: '#f2f2f2' }
      : { backgroundColor: pctToColor(pct) };
  const hlStyle = { filter: 'brightness(90%)' };
  const stickyHeader = { position: 'sticky', top: 0, background: '#fff', zIndex: 3 };
  const stickyFirstCol = { position: 'sticky', left: 0, background: '#fff', zIndex: 2 };
  const stickyCorner = { ...stickyHeader, left: 0 };
  const abxColBase = { whiteSpace: 'nowrap', width: '1%' };

  // ---------- Render-Helfer für die Tabelle ----------
  const renderTable = (mode, ref, ghost = false) => {
    const interactive = !ghost;
    const headers = orgs.map((o, i) =>
      mode === 'superCompact'
        ? { text: `[${i + 1}]`, title: o.name }
        : mode === 'compact'
        ? { text: o.short, title: o.name }
        : { text: o.name, title: undefined },
    );
    const ghostStyle = ghost ? { visibility: 'hidden', height: 0, overflow: 'hidden' } : {};

    return (
      <div style={ghostStyle}>
        <table
          ref={ref}
          className={styles.resistanceTable}
          style={{ borderCollapse: 'separate', borderSpacing: 0 }}
        >
          <thead>
            <tr>
              <th style={{ ...abxColBase, ...stickyCorner }}></th>
              {headers.map((h, colIdx) => (
                <th
                  key={colIdx}
                  style={{
                    ...stickyHeader,
                    cursor: h.title ? 'help' : 'default',
                    ...(interactive && hoverCol === colIdx ? hlStyle : {}),
                  }}
                  onMouseEnter={interactive ? () => setHoverCol(colIdx) : undefined}
                  onMouseLeave={interactive ? () => setHoverCol(null) : undefined}
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
              <tr key={row.antibioticLong}>
                <td
                  style={{
                    ...abxColBase,
                    ...stickyFirstCol,
                    ...(interactive && hoverRow === rowIdx ? hlStyle : {}),
                  }}
                  onMouseEnter={interactive ? () => setHoverRow(rowIdx) : undefined}
                  onMouseLeave={interactive ? () => setHoverRow(null) : undefined}
                >
                  {mode === 'full' ? (
                    row.antibioticLong
                  ) : (
                    <Tip label={row.antibioticLong}>
                      <span>{row.antibioticShort}</span>
                    </Tip>
                  )}
                </td>
                {orgs.map((o, colIdx) => {
                  const cell = row[o.name];
                  const highlight = interactive && (hoverRow === rowIdx || hoverCol === colIdx);
                  return (
                    <td
                      key={o.id}
                      style={{ ...cellStyle(cell?.pct), ...(highlight ? hlStyle : {}) }}
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
      </div>
    );
  };

  // ---------- JSX-Struktur der Komponente ----------
  return (
    <RadixTooltip.Provider delayDuration={0}>
      <div ref={containerRef}>
        <SpecimenSwitcher
          available={availableSpecimens}
          selected={selectedSpecimen}
          onSelect={setSelectedSpecimen}
        />
        {/* Rendert die Tabellen unsichtbar, um ihre Breite zu messen. */}
        {renderTable('full', fullRef, true)}
        {renderTable('compact', compactRef, true)}
        {renderTable('superCompact', superRef, true)}
        {/* Rendert die sichtbare Tabelle, sobald der Anzeigemodus bestimmt ist. */}
        {ready && renderTable(display, null, false)}
      </div>
    </RadixTooltip.Provider>
  );
}