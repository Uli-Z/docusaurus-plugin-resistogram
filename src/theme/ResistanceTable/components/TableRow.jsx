import React from 'react';
import { TableCell } from './TableCell';
import { getHighlightStyle } from '../utils';

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
  }) => {
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
