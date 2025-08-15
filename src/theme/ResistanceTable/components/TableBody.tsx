import React from 'react';
import { TableRow } from './TableRow';

// Mock types
type FormattedRow = Record<string, any> & { rowLong: string; rowShort: string };
type FormattedCol = { id: string; name: string; short: string };
type DisplayMode = 'full' | 'compact' | 'superCompact';

interface TableBodyProps {
  data: FormattedRow[];
  cols: FormattedCol[];
  displayMode: DisplayMode;
  rowsAreAbx: boolean;
  hoveredRow: number | null;
  hoveredCol: number | null;
  onSetHover: (row: number, col: number) => void;
  onClearHover: () => void;
  onShowTooltip: (content: React.ReactNode, element: HTMLElement) => void;
  onHideTooltip: () => void;
  styles: any;
  colorMode: 'dark' | 'light';
  sourceId2ShortName: Map<string, string>;
}

export const TableBody = ({
  data,
  cols,
  displayMode,
  rowsAreAbx,
  hoveredRow,
  hoveredCol,
  onSetHover,
  onClearHover,
  onShowTooltip,
  onHideTooltip,
  styles,
  colorMode,
  sourceId2ShortName,
}: TableBodyProps) => {
  return (
    <tbody>
      {data.map((row, rowIndex) => (
        <TableRow
          key={row.rowLong}
          row={row}
          cols={cols}
          rowIndex={rowIndex}
          displayMode={displayMode}
          rowsAreAbx={rowsAreAbx}
          hoveredRow={hoveredRow}
          hoveredCol={hoveredCol}
          onSetHover={onSetHover}
          onClearHover={onClearHover}
          onShowTooltip={onShowTooltip}
          onHideTooltip={onHideTooltip}
          styles={styles}
          colorMode={colorMode}
          sourceId2ShortName={sourceId2ShortName}
        />
      ))}
    </tbody>
  );
};
