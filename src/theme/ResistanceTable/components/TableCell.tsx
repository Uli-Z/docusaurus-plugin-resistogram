import React from 'react';
import { CellTooltipContent } from '../ui/components';
import { cellStyle, hl } from '../utils';

// Mock types will be replaced with proper types later
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
  onShowTooltip: (content: React.ReactNode, element: HTMLElement) => void;
  onHideTooltip: () => void;
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
    onShowTooltip,
    onHideTooltip,
    styles,
    colorMode,
  }: TableCellProps) => {
    const cell = row[col.name] as FormattedCell;
    const highlight = hoveredRow === rowIndex || hoveredCol === colIndex;

    // This handler is called when the mouse enters the cell.
    // It is responsible for two things:
    // 1. Setting the hover state for row/column highlighting.
    // 2. Showing the tooltip by passing its content and the target element
    //    to the parent component.
    const handleMouseEnter = (event: React.MouseEvent<HTMLTableCellElement>) => {
      onSetHover(rowIndex, colIndex);
      const content = (
        <CellTooltipContent
          row={row}
          col={col}
          cell={cell}
          rowsAreAbx={rowsAreAbx}
        />
      );
      onShowTooltip(content, event.currentTarget);
    };

    // This handler is called when the mouse leaves the cell.
    const handleMouseLeave = () => {
      onClearHover();
      onHideTooltip();
    };

    return (
      <td
        style={{
          ...cellStyle(cell?.pct, colorMode),
          ...(highlight ? hl : {}),
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className={styles.fullCellTrigger}>
          {cell ? `${cell.pct}%` : '—'}
        </span>
      </td>
    );
  },
);
