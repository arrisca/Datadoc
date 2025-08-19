import { TestBed } from '@angular/core/testing';
import { DOCS } from './main';

class RegistryService {
  constructor(private docs: any[]) {}
  ordered() { return [...this.docs].sort((a, b) => a.order - b.order); }
}

describe('RegistryService (concept)', () => {
  it('should sort by order', () => {
    const docs = [
      { id: 'c', title: 'C', section: 'S', order: 3 },
      { id: 'a', title: 'A', section: 'S', order: 1 },
      { id: 'b', title: 'B', section: 'S', order: 2 }
    ];
    const registry = new RegistryService(docs);
    const ordered = registry.ordered();
    expect(ordered.map(d => d.id)).toEqual(['a', 'b', 'c']);
  });
});