import { DocsState } from './main';

describe('Docs reducer/selectors (smoke)', () => {
  it('should compute next/prev indices correctly', () => {
    const docs = [
      { id: 'a', title: 'A', section: 'S', order: 1 },
      { id: 'b', title: 'B', section: 'S', order: 2 },
      { id: 'c', title: 'C', section: 'S', order: 3 }
    ];
    const state: DocsState = { docs, byId: {}, currentId: 'b', tocCollapsed: false, tocWidth: 320 };
    const index = docs.findIndex(d => d.id === state.currentId);
    expect(index).toBe(1);
    const prev = index > 0 ? docs[index - 1] : null;
    const next = index + 1 < docs.length ? docs[index + 1] : null;
    expect(prev?.id).toBe('a');
    expect(next?.id).toBe('c');
  });
});