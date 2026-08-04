import { sourcePublicationStatus } from './product-publication-status';

describe('sourcePublicationStatus', () => {
  it.each([
    ['active', 'ACTIVE'],
    ['DRAFT', 'DRAFT'],
    ['archived', 'ARCHIVED'],
  ])('preserva el estado source %s', (source, expected) => {
    expect(sourcePublicationStatus(source)).toBe(expected);
  });

  it('usa DRAFT solo para un estado source inválido', () => {
    expect(sourcePublicationStatus('UNKNOWN')).toBe('DRAFT');
  });
});
