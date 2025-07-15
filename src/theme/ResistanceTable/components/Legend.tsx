import React from 'react';

interface LegendProps {
  styles: any;
}

export const Legend = ({ styles }: LegendProps) => (
  <div className={styles.legend}>
    <strong>Legend:</strong>
    <span className={styles.legendItem} style={{ backgroundColor: 'var(--ifm-color-success-light)' }}>
      S (≤25%)
    </span>
    <span className={styles.legendItem} style={{ backgroundColor: 'var(--ifm-color-warning-light)' }}>
      I (26-75%)
    </span>
    <span className={styles.legendItem} style={{ backgroundColor: 'var(--ifm-color-danger-light)' }}>
      R (>75%)
    </span>
  </div>
);
