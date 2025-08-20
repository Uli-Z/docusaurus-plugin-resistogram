import React from 'react';
import { hl } from '../utils';

// Mock types
type FormattedCol = { id: string; name: string; short: string };
type DisplayMode = 'full' | 'compact' | 'superCompact';

interface TableHeaderCellProps {
  col: FormattedCol;
  colIndex: number;
  displayMode: DisplayMode;
  hoveredCol: number | null;
  onSetHover: (row: number, col: number) => void;
  onClearHover: () => void;
  onShowTooltip: (content: React.ReactNode, element: HTMLElement) => void;
  onHideTooltip: () => void;
  styles: any;
}

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
  }: TableHeaderCellProps) => {
    const highlight = hoveredCol === colIndex;

    const handleMouseEnter = (event: React.MouseEvent<HTMLTableCellElement>) => {
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
