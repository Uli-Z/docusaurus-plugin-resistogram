import React from 'react';
import { getHighlightStyle } from '../utils';

interface TableHeaderProps {
  cols: { id: string; label: string }[];
  hoveredCol: string | null;
  onSetHover: (hover: { row: string | null; col: string | null }) => void;
  onClearHover: () => void;
  onShowTooltip: (content: React.ReactNode, element: HTMLElement) => void;
  onHideTooltip: () => void;
  styles: any;
  colorMode: 'dark' | 'light';
}

const TableHeaderCell = ({
  col,
  isHovered,
  onHover,
  onLeave,
  styles,
  colorMode,
}: {
  col: { id: string; label: string };
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  styles: any;
  colorMode: 'dark' | 'light';
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
}: TableHeaderProps) => (
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
