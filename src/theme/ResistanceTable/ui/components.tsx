import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDownIcon } from '@radix-ui/react-icons';

// Note: The 'styles' object is now passed as a prop to break the dependency cycle.

export const SourceSwitcher = ({
  sources,
  selected,
  onSelect,
  styles,
}: {
  sources: any[];
  selected: any;
  onSelect: (s: any) => void;
  styles: any;
}) =>
  sources.length <= 1 ? null : (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className={styles.sourceSwitcherTrigger}>
          <span className={styles.sourceSwitcherTriggerInner}>
            <span>{selected?.short_name ?? '—'}</span>
            <ChevronDownIcon className={styles.sourceSwitcherChevron} aria-hidden />
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.sourceSwitcherContent} sideOffset={5}>
          {sources.map((s) => (
            <DropdownMenu.Item
              key={s.file}
              className={styles.sourceSwitcherItem}
              onSelect={() => onSelect(s)}
            >
              {s.short_name}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );

export const CellTooltipContent = ({
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
      <div style={{ marginTop: 4 }}>
        {cell ? (
          <span><strong>Resistance:</strong> {cell.text}</span>
        ) : (
          <span>Keine Daten vorliegen</span>
        )}
      </div>
    </div>
  );
};
