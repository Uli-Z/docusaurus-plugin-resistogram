import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { Source } from '../../../types';

// Recursive component to render the source tree
const SourceMenuItem = ({
  source,
  onSelect,
  styles,
  level = 0,
}: {
  source: Source & { children?: Source[] };
  onSelect: (s: Source) => void;
  styles: any;
  level?: number;
}) => (
  <>
    <DropdownMenu.Item
      key={source.id}
      className={styles.sourceSwitcherItem}
      style={{ paddingLeft: `${1 + level * 1.5}rem` }}
      onSelect={() => onSelect(source)}
    >
      {source.name_de}
    </DropdownMenu.Item>
    {source.children && source.children.length > 0 && (
      source.children.map(child => (
        <SourceMenuItem
          key={child.id}
          source={child}
          onSelect={onSelect}
          styles={styles}
          level={level + 1}
        />
      ))
    )}
  </>
);

export const SourceSwitcher = ({
  sources,
  selected,
  onSelect,
  styles,
}: {
  sources: (Source & { children?: Source[] })[];
  selected: Source | null;
  onSelect: (s: Source) => void;
  styles: any;
}) => {
  if (!sources || sources.length === 0) return null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className={styles.sourceSwitcherTrigger}>
          <span className={styles.sourceSwitcherTriggerInner}>
            <span>{selected?.source_short_name_de ?? '—'}</span>
            <ChevronDownIcon className={styles.sourceSwitcherChevron} aria-hidden />
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.sourceSwitcherContent} sideOffset={5}>
          {sources.map((s) => (
            <SourceMenuItem key={s.id} source={s} onSelect={onSelect} styles={styles} />
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

export const CellTooltipContent = ({
  row,
  col,
  cell,
  rowsAreAbx,
  sourceName,
}: {
  row: any;
  col: any;
  cell: any;
  rowsAreAbx: boolean;
  sourceName?: string;
}) => {
  const rowLabel = rowsAreAbx ? 'Antibiotic' : 'Organism';
  const colLabel = rowsAreAbx ? 'Organism' : 'Antibiotic';
  return (
    <div style={{ textAlign: 'left' }}>
      <div><strong>{rowLabel}:</strong> {row.rowLong}</div>
      <div><strong>{colLabel}:</strong> {col.name}</div>
      <div style={{ marginTop: 4 }}>
        {cell ? (
          <>
            <span><strong>Resistance:</strong> {cell.text}</span>
            {sourceName && <div style={{fontSize: '0.8em', opacity: 0.8}}>Source: {sourceName}</div>}
          </>
        ) : (
          <span>Keine Daten vorliegen</span>
        )}
      </div>
    </div>
  );
};
