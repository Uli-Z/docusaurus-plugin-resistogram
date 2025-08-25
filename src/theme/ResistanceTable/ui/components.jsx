import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import clsx from 'clsx';

// Recursive component to render the source tree
const SourceMenuItem = ({
  source,
  selected,
  onSelect,
  styles,
  level = 0,
  isLast = false,
  locale,
}) => {
  const hasChildren = source.children && source.children.length > 0;
  const isSelected = selected?.id === source.id;

  return (
    <div className={styles.sourceSwitcherItemContainer} role="presentation">
      <DropdownMenu.Item
        key={source.id}
        className={clsx(
          styles.sourceSwitcherItem,
          isSelected && styles.sourceSwitcherItemSelected,
          isLast && styles.sourceSwitcherItemIsLast,
          level > 0 && styles.sourceSwitcherItemIndented,
        )}
        style={{ '--level': level }}
        onSelect={() => onSelect(source)}
        role="menuitemradio"
        aria-checked={isSelected}
      >
        <span className={styles.sourceSwitcherItemInner}>
          <span className={styles.sourceSwitcherItemLabel}>{source[`name_${locale}`] || source.name_en || source.id}</span>
        </span>
      </DropdownMenu.Item>
      {hasChildren && (
        <div className={styles.sourceSwitcherSubMenu} role="group">
          {source.children.map((child, index) => (
            <SourceMenuItem
              key={child.id}
              source={child}
              selected={selected}
              onSelect={onSelect}
              styles={styles}
              level={level + 1}
              isLast={index === source.children.length - 1}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const SourceSwitcher = ({
  sources,
  selected,
  onSelect,
  styles,
  locale,
}) => {
  if (!sources || sources.length === 0) return null;

  const selectedName = selected
    ? selected[`source_short_name_${locale}`] || selected[`name_${locale}`] || selected.source_short_name_en || selected.name_en || selected.id
    : '—';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className={styles.sourceSwitcherTrigger}>
          <span className={styles.sourceSwitcherTriggerInner}>
            <span>{selectedName}</span>
            <ChevronDownIcon className={styles.sourceSwitcherChevron} aria-hidden />
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.sourceSwitcherContent} sideOffset={-1} align="start">
          <DropdownMenu.RadioGroup value={selected?.id}>
            {sources.map((s, index) => (
              <SourceMenuItem
                key={s.id}
                source={s}
                selected={selected}
                onSelect={onSelect}
                styles={styles}
                isLast={index === sources.length - 1}
                locale={locale}
              />
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

export const CellTooltipContent = ({
  row,
  col,
  cell,
  rowsAreAbx,
  sourceName,
  t,
}) => {
  const rowLabel = rowsAreAbx ? t('antibiotic') : t('organism');
  const colLabel = rowsAreAbx ? t('organism') : t('antibiotic');
  return (
    <div style={{ textAlign: 'left' }}>
      <div><strong>{rowLabel}:</strong> {row.rowLong}</div>
      <div><strong>{colLabel}:</strong> {col.name}</div>
      <div style={{ marginTop: 4 }}>
        {cell ? (
          <>
            <span><strong>{t('tooltipResistance')}:</strong> {cell.text}</span>
            {sourceName && <div style={{fontSize: '0.8em', opacity: 0.8}}>{t('source')}: {sourceName}</div>}
          </>
        ) : (
          <span>{t('tooltipNoData')}</span>
        )}
      </div>
    </div>
  );
};
