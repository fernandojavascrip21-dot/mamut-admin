import { TestBed } from '@angular/core/testing';
import { StockChangesService } from './stock-changes.service';

describe('StockChangesService', () => {
  it('la versión empieza en 0 y notify() la sube de uno en uno', () => {
    const service = TestBed.inject(StockChangesService);
    expect(service.version()).toBe(0);
    service.notify();
    service.notify();
    expect(service.version()).toBe(2);
  });
});
