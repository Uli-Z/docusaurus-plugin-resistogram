import React from 'react';
import { CellTooltipContent } from '../ui/components';
import { getCellStyle, getHighlightStyle } from '../utils';

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
  }) => {
    const handleMouseEnter = (event) => {
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
