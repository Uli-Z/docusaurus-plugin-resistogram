import React from 'react';
import { TableRow } from './TableRow';
import type { Resistance } from '../../../types';

interface TableBodyProps {
  data: {
    rowHeader: string;
    rowId: string;
    values: { colId: string; resistance: Resistance | null }[];
  }[];
  cols: { id: string; label: string }[];
  hoveredRow: string | null;
  hoveredCol: string | null;
  onSetHover: (hover: { row: string | null; col: string | null }) => void;
  onClearHover: () => void;
  onShowTooltip: (content: React.ReactNode, element: HTMLElement) => void;
  onHideTooltip: () => void;
  styles: any;
  colorMode: 'dark' | 'light';
}

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
}: TableBodyProps) => (
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
