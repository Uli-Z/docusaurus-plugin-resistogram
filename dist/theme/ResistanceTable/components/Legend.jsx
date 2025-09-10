import React from 'react';
import { usePalette } from '../palette';

// Mock types
// Helper function to remove type annotations for JS conversion
const identity = (props) => props;

export const Legend = ({ cols, displayMode, styles }) => {
  const palette = usePalette();
  if (displayMode === 'full') return null;

  return (
    <div
      className={styles.legend}
      style={{
        backgroundColor: palette?.subtleBg,
        borderTop: `1px solid ${palette?.border}`,
        color: palette?.text,
      }}
    >
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
