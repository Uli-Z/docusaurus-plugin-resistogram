import React from 'react';
import renderer from 'react-test-renderer';
import { SourceSwitcher } from '../src/theme/ResistanceTable/ui/components';
import type { Source } from '../src/types';

// Mock CSS modules
jest.mock('../src/theme/ResistanceTable/styles.module.css', () => ({
  sourceSwitcherTrigger: 'sourceSwitcherTrigger',
  sourceSwitcherTriggerInner: 'sourceSwitcherTriggerInner',
  sourceSwitcherChevron: 'sourceSwitcherChevron',
  sourceSwitcherContent: 'sourceSwitcherContent',
  sourceSwitcherItem: 'sourceSwitcherItem',
}));

describe('SourceSwitcher Component', () => {
  const mockHierarchicalSources: (Source & { children: Source[] })[] = [
    {
      id: 'root', name_de: 'Global', source_file: 'root.csv', url: '', source_short_name_de: 'Gl', year: 2024, children: [
        { id: 'child1', name_de: 'Germany', source_file: 'child1.csv', parent_id: 'root', url: '', source_short_name_de: 'DE', year: 2023, children: [] },
        { id: 'child2', name_de: 'UK', source_file: 'child2.csv', parent_id: 'root', url: '', source_short_name_de: 'UK', year: 2023, children: [] },
      ]
    },
  ];

  it('renders a hierarchical structure correctly', () => {
    const component = renderer.create(
      <SourceSwitcher
        sources={mockHierarchicalSources}
        selected={mockHierarchicalSources[0]}
        onSelect={() => {}}
        styles={{}}
        locale="de"
      />
    );
    let tree = component.toJSON();
    expect(tree).toMatchSnapshot();
  });
});
