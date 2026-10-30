import { sortByName } from './sort-by-name';

describe('sortByName', () => {
  const item = (fullName: string) => ({ fullName });

  it('ordena sin distinguir acentos ni mayúsculas', () => {
    const sorted = sortByName([item('Beto'), item('ana'), item('Ángel')]);
    expect(sorted.map((i) => i.fullName)).toEqual(['ana', 'Ángel', 'Beto']);
  });

  it('no modifica la lista original', () => {
    const original = [item('Beto'), item('Ana')];
    sortByName(original);
    expect(original.map((i) => i.fullName)).toEqual(['Beto', 'Ana']);
  });
});
