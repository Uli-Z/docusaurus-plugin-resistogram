import React from 'react';
import { CellTooltipContent } from '../ui/components';
import { cellStyle, hl } from '../utils';

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
    sourceId2ShortName,
    t,
  }) => {
    const cell = row[col.name];
    const highlight = hoveredRow === rowIndex || hoveredCol === colIndex;

    const handleMouseEnter = (event) => {
      onSetHover(rowIndex, colIndex);
      const content = (
        <CellTooltipContent
          row={row}
          col={col}
          cell={cell}
          rowsAreAbx={rowsAreAbx}
          sourceName={cell?.source_id ? sourceId2ShortName.get(cell.source_id) : undefined}
          t={t}
        />
      );
      onShowTooltip(content, event.currentTarget);
    };

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
        onClick={handleMouseEnter}
      >
        <span className={styles.fullCellTrigger}>
          {cell ? cell.displayText : '—'}
        </span>
      </td>
    );
  },
);
