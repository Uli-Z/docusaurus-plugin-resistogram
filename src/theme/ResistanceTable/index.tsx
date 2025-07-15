import React, { useState, useMemo, useCallback } from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import * as RadixTooltip from '@radix-ui/react-tooltip';

import { TableHeader, TableBody, Legend } from './components';
import { SourceSwitcher } from './ui/components';
import styles from './styles.module.css';
import type {
  Antibiotic,
  Organism,
  Resistance,
  DataSourceNode,
} from '../../types';

// --- Type Definitions for Component Props ---

interface ResistanceTableProps {
  data: string; // The JSON-stringified data from the remark plugin
}

interface PrunedData {
  antibiotics: Record<string, Antibiotic>;
  organisms: Record<string, Organism>;
  resistance: Record<string, Resistance[]>; // Keyed by source_id
  sourceTree: DataSourceNode;
  defaultSourceId: string;
  locale: string;
}

// --- Helper Components ---

const VirtualTrigger = React.forwardRef<HTMLSpanElement, {}>(
  function VirtualTrigger(props, ref) {
    return (
      <span
        ref={ref}
        style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0 }}
      />
    );
  },
);

// --- Main Component ---

export default function ResistanceTable({ data: jsonData }: ResistanceTableProps) {
  const {
    antibiotics,
    organisms,
    resistance,
    sourceTree,
    defaultSourceId,
    locale,
  } = useMemo(() => JSON.parse(jsonData) as PrunedData, [jsonData]);

  const { colorMode } = useColorMode();
  const [selectedSourceId, setSelectedSourceId] = useState(defaultSourceId);
  const [hover, setHover] = useState<{ row: string | null; col: string | null }>({
    row: null,
    col: null,
  });

  // --- Tooltip State and Callbacks ---
  const [tooltipContent, setTooltipContent] = useState<React.ReactNode>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const virtualTriggerRef = React.useRef<HTMLSpanElement>(null);
  const showTooltipTimeout = React.useRef<NodeJS.Timeout>();

  const showTooltip = useCallback(
    (content: React.ReactNode, element: HTMLElement) => {
      clearTimeout(showTooltipTimeout.current);
      showTooltipTimeout.current = setTimeout(() => {
        if (!virtualTriggerRef.current) return;
        const rect = element.getBoundingClientRect();
        virtualTriggerRef.current.style.left = `${rect.left + rect.width / 2}px`;
        virtualTriggerRef.current.style.top = `${rect.top}px`;
        setTooltipContent(content);
        setTooltipOpen(true);
      }, 50);
    },
    [],
  );

  const hideTooltip = useCallback(() => {
    clearTimeout(showTooltipTimeout.current);
    setTooltipOpen(false);
  }, []);

  // --- Data Transformation for Rendering ---

  const getTranslated = (item: any, field: string) =>
    getTranslatedValue(item, field, locale);

  const antibioticList = useMemo(
    () => Object.values(antibiotics),
    [antibiotics],
  );
  const organismList = useMemo(() => Object.values(organisms), [organisms]);

  // This is the core hierarchical data lookup logic
  const getResistanceValue = useCallback(
    (abxCode: string, orgCode: string): Resistance | null => {
      let currentSourceId: string | null = selectedSourceId;
      let sourceMap = new Map<string, DataSourceNode>();
      const buildMap = (node: DataSourceNode) => {
        sourceMap.set(node.id, node);
        node.children.forEach(buildMap);
      };
      buildMap(sourceTree);

      while (currentSourceId) {
        const sourceData = resistance[currentSourceId];
        if (sourceData) {
          const value = sourceData.find(
            (r) => r.antibiotic_id === abxCode && r.organism_id === orgCode,
          );
          if (value) return value;
        }
        const currentNode = sourceMap.get(currentSourceId);
        currentSourceId = currentNode?.parent_id ?? null;
      }
      return null;
    },
    [selectedSourceId, resistance, sourceTree],
  );

  const tableData = useMemo(() => {
    return antibioticList.map((abx) => ({
      rowHeader: getTranslated(abx, 'short_name'),
      rowId: abx.amr_code,
      values: organismList.map((org) => ({
        colId: org.amr_code,
        resistance: getResistanceValue(abx.amr_code, org.amr_code),
      })),
    }));
  }, [antibioticList, organismList, getResistanceValue, locale]);

  const tableCols = useMemo(
    () =>
      organismList.map((org) => ({
        id: org.amr_code,
        label: getTranslated(org, 'full_name'),
      })),
    [organismList, locale],
  );

  return (
    <RadixTooltip.Provider>
      <div className={styles.rootContainer}>
        <SourceSwitcher
          sourceTree={sourceTree}
          selectedId={selectedSourceId}
          onSelect={setSelectedSourceId}
          locale={locale}
          styles={styles}
        />
        <div className={styles.tableContainer}>
          <table className={styles.resistanceTable}>
            <TableHeader
              cols={tableCols}
              hoveredCol={hover.col}
              onSetHover={setHover}
              onClearHover={() => setHover({ row: null, col: null })}
              onShowTooltip={showTooltip}
              onHideTooltip={hideTooltip}
              styles={styles}
            />
            <TableBody
              data={tableData}
              cols={tableCols}
              hoveredRow={hover.row}
              hoveredCol={hover.col}
              onSetHover={setHover}
              onClearHover={() => setHover({ row: null, col: null })}
              onShowTooltip={showTooltip}
              onHideTooltip={hideTooltip}
              styles={styles}
              colorMode={colorMode}
            />
          </table>
        </div>
        <Legend styles={styles} />
      </div>

      <RadixTooltip.Root
        open={tooltipOpen}
        onOpenChange={(isOpen) => {
          setTooltipOpen(isOpen);
          if (!isOpen) setHover({ row: null, col: null });
        }}
      >
        <RadixTooltip.Trigger asChild>
          <VirtualTrigger ref={virtualTriggerRef} />
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side="top"
            align="center"
            sideOffset={5}
            className={styles.tooltipContent}
          >
            {tooltipContent}
            <RadixTooltip.Arrow
              width={8}
              height={4}
              className={styles.tooltipArrow}
            />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}

// Helper function to get translated values, needed for component logic
function getTranslatedValue(item: any, fieldName: string, locale: string): string {
    if (!item) return '';
    return item[`${fieldName}_${locale}`] ?? item[`${fieldName}_en`] ?? (item[fieldName] || '');
}

