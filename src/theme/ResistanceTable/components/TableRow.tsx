import React from 'react';
import { TableCell } from './TableCell';
import { Tip } from '../ui/components';
import { hl } from '../utils';

// Mock types
type FormattedRow = Record<string, any> & { rowLong: string; rowShort: string };
type FormattedCol = { id: string; name: string; short: string };
type DisplayMode = 'full' | 'compact' | 'superCompact';

interface TableRowProps {
  row: FormattedRow;
  cols: FormattedCol[];
  rowIndex: number;
  displayMode: DisplayMode;
  rowsAreAbx: boolean;
  hoveredRow: number | null;
  hoveredCol: number | null;
  onSetHover: (row: number, col: number) => void;
  onClearHover: () => void;
  styles: any;
  colorMode: 'dark' | 'light';
}

export const TableRow = React.memo(
  ({
    row,
    cols,
    rowIndex,
    displayMode,
    rowsAreAbx,
    hoveredRow,
    hoveredCol,
    onSetHover,
    onClearHover,
    styles,
    colorMode,
  }: TableRowProps) => {
    const highlight = hoveredRow === rowIndex;
    const abxCol = { whiteSpace: 'nowrap', width: '1%' } as const;

    const renderRowHeader = () => {
      if (displayMode === 'full') {
        return row.rowLong;
      }
      return (
        <Tip label={row.rowLong} styles={styles}>
          <span className={styles.fullCellTrigger}>{row.rowShort}</span>
        </Tip>
      );
    };

    return (
      <tr
        onMouseEnter={() => onSetHover(rowIndex, -1)} // Hover the whole row
        onMouseLeave={onClearHover}
      >
        <td
          style={{
            ...abxCol,
            ...(highlight ? hl : {}),
          }}
        >
          {renderRowHeader()}
        </td>
        {cols.map((col, colIndex) => (
          <TableCell
            key={col.id}
            row={row}
            col={col}
            rowsAreAbx={rowsAreAbx}
            rowIndex={rowIndex}
            colIndex={colIndex}
            hoveredRow={hoveredRow}
            hoveredCol={hoveredCol}
            onSetHover={onSetHover}
            onClearHover={onClearHover}
            styles={styles}
            colorMode={colorMode}
          />
        ))}
      </tr>
    );
  },
);
