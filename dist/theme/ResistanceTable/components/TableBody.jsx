import React from 'react';
import { TableRow } from './TableRow';

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
  palette,
  t,
}) => {
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
          palette={palette}
          sourceId2ShortName={sourceId2ShortName}
          t={t}
        />
      ))}
    </tbody>
  );
};
