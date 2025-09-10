import React, { useState } from 'react';
import { usePalette } from '../palette';
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
  const palette = usePalette();
  const hasChildren = source.children && source.children.length > 0;
  const isSelected = selected?.id === source.id;
  const [isHighlighted, setIsHighlighted] = useState(false);
  const indentRem = 1 + level * 1.5;
  const itemColor = isSelected ? 'var(--ifm-color-primary)' : (palette?.text ?? undefined);
  const itemBg = isHighlighted ? (palette?.subtleBgHover ?? undefined) : undefined;

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
        style={{ '--level': String(level), color: itemColor, backgroundColor: itemBg, paddingLeft: `${indentRem}rem` }}
        onSelect={() => onSelect(source)}
        role="menuitemradio"
        aria-checked={isSelected}
        onPointerEnter={() => setIsHighlighted(true)}
        onPointerLeave={() => setIsHighlighted(false)}
        onFocus={() => setIsHighlighted(true)}
        onBlur={() => setIsHighlighted(false)}
      >
        <span className={styles.sourceSwitcherItemInner} style={{ color: itemColor }}>
          <span className={styles.sourceSwitcherItemLabel} style={{ color: itemColor }}>
            {source[`name_${locale}`] || source.name_en || source.id}
          </span>
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
              palette={palette}
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
  const palette = usePalette();
  if (!sources || sources.length === 0) return null;

  const selectedName = selected
    ? selected[`source_short_name_${locale}`] || selected[`name_${locale}`] || selected.source_short_name_en || selected.name_en || selected.id
    : '—';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={styles.sourceSwitcherTrigger}
          style={{
            backgroundColor: palette?.subtleBg,
            border: `1px solid ${palette?.border}`,
            color: palette?.text,
            borderBottomColor: palette?.background,
          }}
        >
          <span className={styles.sourceSwitcherTriggerInner}>
            <span>{selectedName}</span>
            <ChevronDownIcon
              className={styles.sourceSwitcherChevron}
              aria-hidden
              style={{ color: palette?.mutedText ?? palette?.sourceInfoText }}
            />
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.sourceSwitcherContent}
          sideOffset={-1}
          align="start"
          style={{
            backgroundColor: palette?.background,
            border: `1px solid ${palette?.border}`,
            color: palette?.text,
          }}
        >
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
                palette={palette}
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
            <span>
              <strong>{t('tooltipResistance')}:</strong>{' '}
              {cell.isIntrinsic
                ? t('intrinsicResistance')
                : `${cell.pct}% (n=${cell.n})`}
            </span>
            {sourceName && (
              <div style={{ fontSize: '0.8em', opacity: 0.8 }}>
                {t('source')}: {sourceName}
              </div>
            )}
          </>
        ) : (
          <span>{t('tooltipNoData')}</span>
        )}
      </div>
    </div>
  );
};
