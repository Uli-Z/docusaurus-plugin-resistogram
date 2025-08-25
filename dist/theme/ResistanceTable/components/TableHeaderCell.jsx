import React from 'react';
import { hl } from '../utils';

export const TableHeaderCell = React.memo(
  ({
    col,
    colIndex,
    displayMode,
    hoveredCol,
    onSetHover,
    onClearHover,
    onShowTooltip,
    onHideTooltip,
    styles,
  }) => {
    const highlight = hoveredCol === colIndex;

    const handleMouseEnter = (event) => {
      onSetHover(-1, colIndex);
      if (displayMode !== 'full') {
        onShowTooltip(col.name, event.currentTarget);
      }
    };

    const handleMouseLeave = () => {
      onClearHover();
      onHideTooltip();
    };

    const renderContent = () => {
      switch (displayMode) {
        case 'superCompact':
          return `[${colIndex + 1}]`;
        case 'compact':
          return col.short;
        default:
          return col.name;
      }
    };

    return (
      <th
        style={{
          cursor: displayMode !== 'full' ? 'help' : 'default',
          ...(highlight ? hl : {}),
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleMouseEnter}
      >
        <span className={styles.fullCellTrigger}>{renderContent()}</span>
      </th>
    );
  },
);
