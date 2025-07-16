import React from 'react';

export const Legend = ({ styles }) => (
  <div className={styles.legend}>
    <strong>Legend:</strong>
    <span className={styles.legendItem} style={{ backgroundColor: 'var(--ifm-color-success-light)' }}>
      S (≤25%)
    </span>
    <span className={styles.legendItem} style={{ backgroundColor: 'var(--ifm-color-warning-light)' }}>
      I (26-75%)
    </span>
    <span className={styles.legendItem} style={{ backgroundColor: 'var(--ifm-color-danger-light)' }}>
      R (&gt;75%)
    </span>
  </div>
);
