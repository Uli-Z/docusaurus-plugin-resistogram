import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { Source } from '../../../types';
import { Locale, getTranslator } from '../i18n';

type Translator = ReturnType<typeof getTranslator>;

// Recursive component to render the source tree
const SourceMenuItem = ({
  source,
  onSelect,
  styles,
  level = 0,
  locale,
}: {
  source: Source & { children?: Source[] };
  onSelect: (s: Source) => void;
  styles: any;
  level?: number;
  locale: Locale;
}) => (
  <>
    <DropdownMenu.Item
      key={source.id}
      className={styles.sourceSwitcherItem}
      style={{ paddingLeft: `${1 + level * 1.5}rem` }}
      onSelect={() => onSelect(source)}
    >
      {source[`name_${locale}`] || source.name_en || source.id}
    </DropdownMenu.Item>
    {source.children && source.children.length > 0 && (
      source.children.map(child => (
        <SourceMenuItem
          key={child.id}
          source={child}
          onSelect={onSelect}
          styles={styles}
          level={level + 1}
          locale={locale}
        />
      ))
    )}
  </>
);

export const SourceSwitcher = ({
  sources,
  selected,
  onSelect,
  styles,
  locale,
}: {
  sources: (Source & { children?: Source[] })[];
  selected: Source | null;
  onSelect: (s: Source) => void;
  styles: any;
  locale: Locale;
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
        <DropdownMenu.Content className={styles.sourceSwitcherContent} sideOffset={5}>
          {sources.map((s) => (
            <SourceMenuItem key={s.id} source={s} onSelect={onSelect} styles={styles} locale={locale} />
          ))}
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
}: {
  row: any;
  col: any;
  cell: any;
  rowsAreAbx: boolean;
  sourceName?: string;
  t: Translator;
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
