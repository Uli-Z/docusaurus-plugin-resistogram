import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import type { DataSourceNode, Resistance } from '../../../types';

// --- Helper Functions ---

const getTranslatedValue = (item: any, fieldName: string, locale: string): string => {
  if (!item) return '';
  return item[`${fieldName}_${locale}`] ?? item[`${fieldName}_en`] ?? (item[fieldName] || '');
};

// --- Components ---

const SourceMenuItem = ({
  node,
  onSelect,
  level,
  styles,
  locale,
}: {
  node: DataSourceNode;
  onSelect: (id: string) => void;
  level: number;
  styles: any;
  locale: string;
}) => (
  <>
    <DropdownMenu.Item
      className={styles.sourceSwitcherItem}
      style={{ paddingLeft: `${10 + level * 15}px` }}
      onSelect={() => onSelect(node.id)}
    >
      {getTranslatedValue(node, 'name', locale)}
    </DropdownMenu.Item>
    {node.children.map((child) => (
      <SourceMenuItem
        key={child.id}
        node={child}
        onSelect={onSelect}
        level={level + 1}
        styles={styles}
        locale={locale}
      />
    ))}
  </>
);

export const SourceSwitcher = ({
  sourceTree,
  selectedId,
  onSelect,
  locale,
  styles,
}: {
  sourceTree: DataSourceNode;
  selectedId: string;
  onSelect: (id: string) => void;
  locale: string;
  styles: any;
}) => {
  const findNode = (id: string, node: DataSourceNode): DataSourceNode | null => {
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = findNode(id, child);
      if (found) return found;
    }
    return null;
  };

  const selectedNode = findNode(selectedId, sourceTree);
  const selectedName = selectedNode
    ? getTranslatedValue(selectedNode, 'name', locale)
    : 'Select Source';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className={styles.sourceSwitcherTrigger}>
          <span className={styles.sourceSwitcherTriggerInner}>
            <span>{selectedName}</span>
            <ChevronDownIcon
              className={styles.sourceSwitcherChevron}
              aria-hidden
            />
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.sourceSwitcherContent}
          sideOffset={5}
        >
          <SourceMenuItem
            node={sourceTree}
            onSelect={onSelect}
            level={0}
            styles={styles}
            locale={locale}
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

export const CellTooltipContent = ({
  rowHeader,
  colHeader,
  resistance,
}: {
  rowHeader: string;
  colHeader: string;
  resistance: Resistance | null;
}) => (
  <div style={{ textAlign: 'left' }}>
    <div>
      <strong>Antibiotic:</strong> {rowHeader}
    </div>
    <div>
      <strong>Organism:</strong> {colHeader}
    </div>
    <div style={{ marginTop: 4 }}>
      {resistance ? (
        <span>
          <strong>Resistance:</strong> {resistance.resistance_pct}% (n=
          {resistance.n_isolates})
        </span>
      ) : (
        <span>No data available</span>
      )}
    </div>
  </div>
);
