import { jest } from '@jest/globals';
import { vol } from 'memfs';
import type { Source } from '../src/types';

jest.doMock('fs/promises', () => ({
  readFile: vol.promises.readFile,
}));

describe('Data Hierarchy Logic', () => {
  let getPathToSource: (sources: Source[], targetId: string) => Source[];
  let loadResistanceDataForSource: (source: Source, allSources: Source[], dataDir: string) => Promise<any[]>;

  const mockSources: Source[] = [
    { id: 'root', name_de: 'Global', source_file: 'root.csv', url: '', source_short_name_de: 'Gl' },
    { id: 'child1', name_de: 'Germany', source_file: 'child1.csv', parent_id: 'root', url: '', source_short_name_de: 'DE' },
    { id: 'child2', name_de: 'UK', source_file: 'child2.csv', parent_id: 'root', url: '', source_short_name_de: 'UK' },
    { id: 'grandchild1', name_de: 'Berlin', source_file: 'grandchild1.csv', parent_id: 'child1', url: '', source_short_name_de: 'BE' },
  ];

  beforeAll(async () => {
    const dataModule = await import('../src/data');
    getPathToSource = dataModule.getPathToSource;
    loadResistanceDataForSource = dataModule.loadResistanceDataForSource;
  });

  beforeEach(() => {
    vol.reset();
    const mockCsvData = {
      '/data/root.csv': `antibiotic_id,organism_id,resistance_pct
PEN,E_COLI,80
AMX,E_COLI,70`,
      '/data/child1.csv': `antibiotic_id,organism_id,resistance_pct
PEN,E_COLI,85
CIP,E_COLI,10`,
      '/data/grandchild1.csv': `antibiotic_id,organism_id,resistance_pct
PEN,E_COLI,88`,
    };
    vol.fromJSON(mockCsvData);
  });

  describe('getPathToSource', () => {
    it('should return the full path for a grandchild node', () => {
      const path = getPathToSource(mockSources, 'grandchild1');
      expect(path.map((s: Source) => s.id)).toEqual(['root', 'child1', 'grandchild1']);
    });
  });

  describe('loadResistanceDataForSource', () => {
    it('should merge and override data correctly down the hierarchy', async () => {
      const targetSource = mockSources.find(s => s.id === 'grandchild1')!;
      const data = await loadResistanceDataForSource(targetSource, mockSources, '/data');
      const dataMap = new Map(data.map((item: any) => [`${item.antibiotic_id}-${item.organism_id}`, item.resistance_pct]));
      expect(dataMap.get('PEN-E_COLI')).toBe(88);
      expect(dataMap.get('AMX-E_COLI')).toBe(70);
      expect(dataMap.get('CIP-E_COLI')).toBe(10);
      expect(data.length).toBe(3);
    });
  });
});