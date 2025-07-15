import React from 'react';
import { TableCell } from './TableCell';
import { getHighlightStyle } from '../utils';
import type { Resistance } from '../../../types';

interface TableRowProps {
  rowData: {
    rowHeader: string;
    rowId: string;
    values: { colId: string; resistance: Resistance | null }[];
  };
  cols: { id: string; label: string }[];
  hoveredRow: string | null;
  hoveredCol: string | null;
  onSetHover: (hover: { row: string | null; col: string | null }) => void;
  onClearHover: () => void;
  onShowTooltip: (content: React.ReactNode, element: HTMLElement) => void;
  onHideTooltip: () => void;
  styles: any;
  colorMode: 'dark' | 'light';
}

export const TableRow = React.memo(
  ({
    rowData,
    cols,
    hoveredRow,
    hoveredCol,
    onSetHover,
    onClearHover,
    onShowTooltip,
    onHideTooltip,
    styles,
    colorMode,
  }: TableRowProps) => {
    const isHovered = hoveredRow === rowData.rowId;

    return (
      <tr>
        <td
          style={isHovered ? getHighlightStyle(colorMode) : {}}
          onMouseEnter={() => onSetHover({ row: rowData.rowId, col: null })}
          onMouseLeave={onClearHover}
        >
          {rowData.rowHeader}
        </td>
        {rowData.values.map(({ colId, resistance }) => (
          <TableCell
            key={colId}
            rowId={rowData.rowId}
            colId={colId}
            rowHeader={rowData.rowHeader}
            colHeader={cols.find(c => c.id === colId)?.label ?? ''}
            resistance={resistance}
            isHovered={isHovered || hoveredCol === colId}
            onHover={() => onSetHover({ row: rowData.rowId, col: colId })}
            onLeave={onClearHover}
            onShowTooltip={onShowTooltip}
            onHideTooltip={onHideTooltip}
            styles={styles}
            colorMode={colorMode}
          />
        ))}
      </tr>
    );
  },
);
