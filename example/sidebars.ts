import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: 'doc',
      id: 'index',
      label: 'Introduction',
    },
    {
      type: 'category',
      label: 'Live Demo: Pneumonia Treatment',
      items: [
        'pneumonia-demo/community-acquired',
        'pneumonia-demo/hospital-acquired',
        'pneumonia-demo/specific-pathogens',
      ],
    },
    {
      type: 'category',
      label: 'Feature Examples',
      items: [
        'advanced-features/data-sources',
        'advanced-features/class-selection',
      ],
    },
    {
      type: 'category',
      label: 'Test Cases',
      items: [
        'test-cases/no-data',
        'test-cases/unresolved-ids',
      ],
    },
  ],
};

export default sidebars;
