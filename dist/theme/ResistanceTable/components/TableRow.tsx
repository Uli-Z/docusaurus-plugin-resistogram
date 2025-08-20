import React from 'react';
import { TableCell } from './TableCell';
import { hl } from '../utils';
import { getTranslator } from '../i18n';

type Translator = ReturnType<typeof getTranslator>;

// Mock types
type FormattedRow = Record<string, any> & { rowLong: string; rowShort: string };
type FormattedCol = { id: string; name: string; short: string };
type DisplayMode = 'full' | 'compact' | 'superCompact';

interface TableRowProps {
  row: FormattedRow;
  cols: FormattedCol[];
  rowIndex: number;
  displayMode: DisplayMode;
  rowsAreAbx: boolean;
  hoveredRow: number | null;
  hoveredCol: number | null;
  onSetHover: (row: number, col: number) => void;
  onClearHover: () => void;
  onShowTooltip: (content: React.ReactNode, element: HTMLElement) => void;
  onHideTooltip: () => void;
  styles: any;
  colorMode: 'dark' | 'light';
  sourceId2ShortName: Map<string, string>;
  t: Translator;
}

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
    colorMode,
    sourceId2ShortName,
    t,
  }: TableRowProps) => {
    const highlight = hoveredRow === rowIndex;
    const abxCol = { whiteSpace: 'nowrap', width: '1%' } as const;

    const handleMouseEnter = (event: React.MouseEvent<HTMLTableCellElement>) => {
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
            colorMode={colorMode}
            sourceId2ShortName={sourceId2ShortName}
            t={t}
          />
        ))}
      </tr>
    );
  },
);
