import type { MessageKey } from '../../shared/i18n';
import type { Layout } from '../../shared/types';
import { useT } from '../i18n';
import { api } from '../use-multi';
import { SegmentedControl } from './SegmentedControl';

const OPTIONS: { mode: Layout; label: MessageKey }[] = [
  { mode: 'single', label: 'layout.single' },
  { mode: 'grid', label: 'layout.grid' },
];

export function LayoutToggle({ layout }: { layout: Layout }) {
  const t = useT();
  return (
    <SegmentedControl
      label={t('layout.label')}
      value={layout}
      options={OPTIONS.map(({ mode, label }) => ({ value: mode, label: t(label) }))}
      onChange={(mode) => void api.setLayout(mode)}
    />
  );
}
