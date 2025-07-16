import React from 'react';
import { TableRow } from './TableRow';

export const TableBody = ({
  data,
  cols,
  hoveredRow,
  hoveredCol,
  onSetHover,
  onClearHover,
  onShowTooltip,
  onHideTooltip,
  styles,
  colorMode,
}) => (
  <tbody>
    {data.map((rowData) => (
      <TableRow
        key={rowData.rowId}
        rowData={rowData}
        cols={cols}
        hoveredRow={hoveredRow}
        hoveredCol={hoveredCol}
        onSetHover={onSetHover}
        onClearHover={onClearHover}
        onShowTooltip={onShowTooltip}
        onHideTooltip={onHideTooltip}
        styles={styles}
        colorMode={colorMode}
      />
    ))}
  </tbody>
);
