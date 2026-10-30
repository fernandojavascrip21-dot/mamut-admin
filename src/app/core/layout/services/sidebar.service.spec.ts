import { TestBed } from '@angular/core/testing';
import { SIDEBAR_COLLAPSED_KEY } from '../constants/sidebar.constants';
import { SidebarService } from './sidebar.service';

describe('SidebarService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => localStorage.clear());

  it('arranca mostrada si no hay preferencia guardada', () => {
    expect(TestBed.inject(SidebarService).collapsed()).toBe(false);
  });

  it('alterna y recuerda la preferencia', () => {
    const service = TestBed.inject(SidebarService);
    service.toggle();
    expect(service.collapsed()).toBe(true);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('1');
    service.toggle();
    expect(service.collapsed()).toBe(false);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('0');
  });

  it('arranca oculta si la preferencia guardada lo indica', () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '1');
    expect(TestBed.inject(SidebarService).collapsed()).toBe(true);
  });
});
