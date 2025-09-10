import React from 'react';
import { TableHeaderCell } from './TableHeaderCell';

export const TableHeader = ({
  cols,
  displayMode,
  hoveredCol,
  onSetHover,
  onClearHover,
  onShowTooltip,
  onHideTooltip,
  styles,
  palette,
}) => {
  const abxCol = { whiteSpace: 'nowrap', width: '1%' };

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
            palette={palette}
          />
        ))}
      </tr>
    </thead>
  );
};
