import React from 'react';
import { Tip } from '../ui/components';
import { hl } from '../utils';

// Mock types
type FormattedCol = { id: string; name: string; short: string };
type DisplayMode = 'full' | 'compact' | 'superCompact';

interface TableHeaderCellProps {
  col: FormattedCol;
  colIndex: number;
  displayMode: DisplayMode;
  hoveredCol: number | null;
  onSetHover: (row: number, col: number) => void;
  onClearHover: () => void;
  styles: any;
}

export const TableHeaderCell = React.memo(
  ({
    col,
    colIndex,
    displayMode,
    hoveredCol,
    onSetHover,
    onClearHover,
    styles,
  }: TableHeaderCellProps) => {
    const highlight = hoveredCol === colIndex;

    const renderContent = () => {
      switch (displayMode) {
        case 'superCompact':
          return (
            <Tip label={col.name} styles={styles}>
              <span className={styles.fullCellTrigger}>{`[${
                colIndex + 1
              }]`}</span>
            </Tip>
          );
        case 'compact':
          return (
            <Tip label={col.name} styles={styles}>
              <span className={styles.fullCellTrigger}>{col.short}</span>
            </Tip>
          );
        default:
          return col.name;
      }
    };

    return (
      <th
        style={{
          cursor: displayMode !== 'full' ? 'help' : 'default',
          ...(highlight ? hl : {}),
        }}
        onMouseEnter={() => onSetHover(-1, colIndex)}
        onMouseLeave={onClearHover}
      >
        {renderContent()}
      </th>
    );
  },
);
