import { fractionModalLink } from '@shared/utils/modal-links';
import { YO_QUICK_ACTIONS } from './stock-page.constants';

describe('YO_QUICK_ACTIONS · Fraccionar (HU-23)', () => {
  it('incluye «Fraccionar» hacia /admin/fraccionar con el ícono fraction', () => {
   expect(YO_QUICK_ACTIONS).toContainEqual({ label: 'Fraccionar', link: fractionModalLink(), icon: 'fraction' });
  });

  it('va justo antes de «Nuevo producto»', () => {
    const labels = YO_QUICK_ACTIONS.map((action) => action.label);
    expect(labels.indexOf('Fraccionar')).toBeGreaterThanOrEqual(0);
    expect(labels.indexOf('Fraccionar')).toBe(labels.indexOf('Nuevo producto') - 1);
  });
});
