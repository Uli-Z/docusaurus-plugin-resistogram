import { selectDataSource } from '../src/data';
import { Source } from '../src/types';

const mockSources: Source[] = [
  { id: 'A', parent_id: undefined, name_de: 'Source A 2022', year: 2022, source_file: 'a.csv', url: '', long_name: '' },
  { id: 'B', parent_id: 'A', name_de: 'Source B 2023', year: 2023, source_file: 'b.csv', url: '', long_name: '' },
  { id: 'C', parent_id: 'A', name_de: 'Source C 2023', year: 2023, source_file: 'c.csv', url: '', long_name: '' },
  { id: 'D', parent_id: 'B', name_de: 'Source D 2023', year: 2023, source_file: 'd.csv', url: '', long_name: '' },
  { id: 'E', parent_id: undefined, name_de: 'Source E 2024', year: 2024, source_file: 'e.csv', url: '', long_name: '' },
];

describe('selectDataSource', () => {
  it('should select the newest source when no src is provided', () => {
    const selected = selectDataSource(undefined, mockSources);
    expect(selected.id).toBe('E');
  });

  it('should filter by year and select the one with the most parents', () => {
    const selected = selectDataSource('2023', mockSources);
    expect(selected.id).toBe('D'); // D has 2 parents (B, A), C and B have 1 parent (A)
  });

  it('should filter by year and use file order as a tie-breaker for parent count', () => {
    const sourcesWithTie = [
        ...mockSources,
        { id: 'F', parent_id: 'C', name_de: 'Source F 2023', year: 2023, source_file: 'f.csv', url: '', long_name: '', short_name: '' },
    ];
    const selected = selectDataSource('2023', sourcesWithTie);
    expect(selected.id).toBe('D'); // D and F both have 2 parents, but D comes first in the original array
  });

  it('should filter by a string and select the one with the most parents', () => {
    const selected = selectDataSource('Source', mockSources);
    expect(selected.id).toBe('D');
  });

  it('should return the newest source if filter is not specific enough', () => {
    const selected = selectDataSource('2023', mockSources.filter(s => s.id !== 'D'));
    expect(selected.id).toBe('B'); // B and C have same parent count and year, B is first
  });

  it('should handle case-insensitive filtering', () => {
    const selected = selectDataSource('source c', mockSources);
    expect(selected.id).toBe('C');
  });

  it('should return the newest overall if no match is found', () => {
    const selected = selectDataSource('nonexistent', mockSources);
    expect(selected.id).toBe('E');
  });
});
