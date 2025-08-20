import React from 'react';

// Mock types
type FormattedCol = { id: string; name: string; short: string };
type DisplayMode = 'full' | 'compact' | 'superCompact';

interface LegendProps {
  cols: FormattedCol[];
  displayMode: DisplayMode;
  styles: any;
}

export const Legend = ({ cols, displayMode, styles }: LegendProps) => {
  if (displayMode === 'full') return null;

  return (
    <div className={styles.legend}>
      {cols.map((c, i) => (
        <span key={c.id}>
          <b>{displayMode === 'superCompact' ? `[${i + 1}]` : c.short}:</b>{' '}
          {c.name}
          {i < cols.length - 1 && '; '}
        </span>
      ))}
    </div>
  );
};
