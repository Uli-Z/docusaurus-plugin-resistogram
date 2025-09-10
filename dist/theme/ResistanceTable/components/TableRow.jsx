import React from 'react';
import { TableCell } from './TableCell';
import { hl } from '../utils';

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
    onShowTooltip,
    onHideTooltip,
    styles,
    palette,
    colorMode,
    sourceId2ShortName,
    t,
  }) => {
    const highlight = hoveredRow === rowIndex;
    const abxCol = { whiteSpace: 'nowrap', width: '1%' };

    const handleMouseEnter = (event) => {
      onSetHover(rowIndex, -1); // Hover the whole row
      if (displayMode !== 'full') {
        onShowTooltip(row.rowLong, event.currentTarget);
      }
    };

    const handleMouseLeave = () => {
      onClearHover();
      onHideTooltip();
    };

    const renderRowHeader = () => {
      const content = displayMode === 'full' ? row.rowLong : row.rowShort;
      return <span className={styles.fullCellTrigger}>{content}</span>;
    };

    return (
      <tr>
        <td
          style={{
            ...abxCol,
            color: palette?.text,
            ...(highlight ? hl : {}),
            cursor: displayMode !== 'full' ? 'help' : 'default',
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleMouseEnter}
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
            onShowTooltip={onShowTooltip}
            onHideTooltip={onHideTooltip}
            styles={styles}
            palette={palette}
            colorMode={colorMode}
            sourceId2ShortName={sourceId2ShortName}
            t={t}
          />
        ))}
      </tr>
    );
  },
);
