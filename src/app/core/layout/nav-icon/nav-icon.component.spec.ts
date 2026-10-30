import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavIconComponent } from './nav-icon.component';
import type { NavIcon } from '../top-nav/top-nav.models';

describe('NavIconComponent', () => {
  let fixture: ComponentFixture<NavIconComponent>;

  function render(name: NavIcon) {
    fixture = TestBed.createComponent(NavIconComponent);
    fixture.componentRef.setInput('name', name);
    fixture.detectChanges();
  }

  it('dibuja un svg decorativo oculto a lectores de pantalla', async () => {
    await TestBed.configureTestingModule({ imports: [NavIconComponent] }).compileComponents();
    render('package');
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it.each<NavIcon>(['package', 'tag', 'bag', 'receipt', 'users', 'cart'])(
    'el ícono %s trae al menos un trazo',
    async (name) => {
      await TestBed.configureTestingModule({ imports: [NavIconComponent] }).compileComponents();
      render(name);
      expect(fixture.nativeElement.querySelectorAll('svg > *').length).toBeGreaterThan(0);
    },
  );
});
