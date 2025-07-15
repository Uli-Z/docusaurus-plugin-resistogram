import React from 'react';
import { CellTooltipContent } from '../ui/components';
import { getCellStyle, getHighlightStyle } from '../utils';
import type { Resistance } from '../../../types';

interface TableCellProps {
  rowId: string;
  colId: string;
  rowHeader: string;
  colHeader: string;
  resistance: Resistance | null;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onShowTooltip: (content: React.ReactNode, element: HTMLElement) => void;
  onHideTooltip: () => void;
  styles: any;
  colorMode: 'dark' | 'light';
}

export const TableCell = React.memo(
  ({
    rowHeader,
    colHeader,
    resistance,
    isHovered,
    onHover,
    onLeave,
    onShowTooltip,
    onHideTooltip,
    styles,
    colorMode,
  }: TableCellProps) => {
    const handleMouseEnter = (event: React.MouseEvent<HTMLTableCellElement>) => {
      onHover();
      const content = (
        <CellTooltipContent
          rowHeader={rowHeader}
          colHeader={colHeader}
          resistance={resistance}
        />
      );
      onShowTooltip(content, event.currentTarget);
    };

    return (
      <td
        style={{
          ...getCellStyle(resistance?.resistance_pct, colorMode),
          ...(isHovered ? getHighlightStyle(colorMode) : {}),
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={onLeave}
        onClick={handleMouseEnter} // For touch devices
      >
        <span className={styles.fullCellTrigger}>
          {resistance ? `${resistance.resistance_pct}%` : '—'}
        </span>
      </td>
    );
  },
);
