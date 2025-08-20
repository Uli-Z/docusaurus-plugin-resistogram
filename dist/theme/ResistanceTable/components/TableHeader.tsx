import React from 'react';
import { TableHeaderCell } from './TableHeaderCell';

// Mock types
type FormattedCol = { id: string; name: string; short: string };
type DisplayMode = 'full' | 'compact' | 'superCompact';

interface TableHeaderProps {
  cols: FormattedCol[];
  displayMode: DisplayMode;
  hoveredCol: number | null;
  onSetHover: (row: number, col: number) => void;
  onClearHover: () => void;
  onShowTooltip: (content: React.ReactNode, element: HTMLElement) => void;
  onHideTooltip: () => void;
  styles: any;
}

export const TableHeader = ({
  cols,
  displayMode,
  hoveredCol,
  onSetHover,
  onClearHover,
  onShowTooltip,
  onHideTooltip,
  styles,
}: TableHeaderProps) => {
  const abxCol = { whiteSpace: 'nowrap', width: '1%' } as const;

  return (
    <thead>
      <tr>
        <th style={abxCol}></th>
        {cols.map((col, colIndex) => (
          <TableHeaderCell
            key={col.id}
            col={col}
            colIndex={colIndex}
            displayMode={displayMode}
            hoveredCol={hoveredCol}
            onSetHover={onSetHover}
            onClearHover={onClearHover}
            onShowTooltip={onShowTooltip}
            onHideTooltip={onHideTooltip}
            styles={styles}
          />
        ))}
      </tr>
    </thead>
  );
};
