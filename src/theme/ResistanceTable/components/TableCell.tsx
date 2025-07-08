import React from 'react';
import { Tip, CellTooltipContent } from '../ui/components';
import { cellStyle, hl } from '../utils';

// Mock types for now, will be replaced with proper types later
type FormattedCell = { text: string; pct?: number };
type FormattedRow = Record<string, any> & { rowLong: string; rowShort: string };
type FormattedCol = { id: string; name: string; short: string };

interface TableCellProps {
  row: FormattedRow;
  col: FormattedCol;
  rowsAreAbx: boolean;
  rowIndex: number;
  colIndex: number;
  hoveredRow: number | null;
  hoveredCol: number | null;
  onSetHover: (row: number, col: number) => void;
  onClearHover: () => void;
  styles: any;
  colorMode: 'dark' | 'light';
}

export const TableCell = React.memo(
  ({
    row,
    col,
    rowsAreAbx,
    rowIndex,
    colIndex,
    hoveredRow,
    hoveredCol,
    onSetHover,
    onClearHover,
    styles,
    colorMode,
  }: TableCellProps) => {
    const cell = row[col.name] as FormattedCell;
    const highlight = hoveredRow === rowIndex || hoveredCol === colIndex;

    return (
      <td
        style={{
          ...cellStyle(cell?.pct, colorMode),
          ...(highlight ? hl : {}),
        }}
        onMouseEnter={() => onSetHover(rowIndex, colIndex)}
        onMouseLeave={onClearHover}
      >
        <Tip
          label={
            <CellTooltipContent
              row={row}
              col={col}
              cell={cell}
              rowsAreAbx={rowsAreAbx}
            />
          }
          styles={styles}
        >
          <span className={styles.fullCellTrigger}>
            {cell ? cell.text : '—'}
          </span>
        </Tip>
      </td>
    );
  },
);
