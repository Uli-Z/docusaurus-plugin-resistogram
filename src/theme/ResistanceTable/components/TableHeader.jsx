import React from 'react';
import { getHighlightStyle } from '../utils';

const TableHeaderCell = ({
  col,
  isHovered,
  onHover,
  onLeave,
  styles,
  colorMode,
}) => (
  <th
    style={isHovered ? getHighlightStyle(colorMode) : {}}
    onMouseEnter={onHover}
    onMouseLeave={onLeave}
  >
    <div className={styles.verticalText}>{col.label}</div>
  </th>
);

export const TableHeader = ({
  cols,
  hoveredCol,
  onSetHover,
  onClearHover,
  styles,
  colorMode,
}) => (
  <thead>
    <tr>
      <th />
      {cols.map((col) => (
        <TableHeaderCell
          key={col.id}
          col={col}
          isHovered={hoveredCol === col.id}
          onHover={() => onSetHover({ row: null, col: col.id })}
          onLeave={onClearHover}
          styles={styles}
          colorMode={colorMode}
        />
      ))}
    </tr>
  </thead>
);
