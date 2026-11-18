import { TestBed } from '@angular/core/testing';
import { SellerChangesService } from './seller-changes.service';

describe('SellerChangesService', () => {
  it('empieza en 0 y cada notify() sube la versión en uno', () => {
    const service = TestBed.inject(SellerChangesService);
    expect(service.version()).toBe(0);
    service.notify();
    expect(service.version()).toBe(1);
    service.notify();
    expect(service.version()).toBe(2);
  });

  it('es un servicio de root: todos ven el mismo contador', () => {
    TestBed.inject(SellerChangesService).notify();
    expect(TestBed.inject(SellerChangesService).version()).toBe(1);
  });
});
