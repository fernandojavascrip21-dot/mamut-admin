import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginBackgroundComponent } from './login-background.component';
import { STOCK_BARS } from './login-background.constants';

describe('LoginBackgroundComponent', () => {
  let fixture: ComponentFixture<LoginBackgroundComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LoginBackgroundComponent] });
    fixture = TestBed.createComponent(LoginBackgroundComponent);
    fixture.detectChanges();
  });

  const bars = () => Array.from(fixture.nativeElement.querySelectorAll('.stock-bar')) as HTMLElement[];

  it('es decorativo: todo el fondo queda oculto para lectores de pantalla', () => {
    const root = fixture.nativeElement.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
  });

  it('dibuja una columna por barra: crece al entrar y adentro sube y baja, con cuatro segmentos', () => {
    expect(bars()).toHaveLength(STOCK_BARS.length);
    bars().forEach((bar, index) => {
      expect(bar.style.height).toBe(`${STOCK_BARS[index].heightPercent}%`);
      expect(bar.style.animationDelay).toBe(`${STOCK_BARS[index].growDelaySeconds}s`);
      const level = bar.querySelector('.stock-level') as HTMLElement;
      expect(level.style.animationDuration).toBe(`${STOCK_BARS[index].durationSeconds}s`);
      expect(level.style.animationDelay).toBe(`${STOCK_BARS[index].delaySeconds}s`);
      expect(level.querySelectorAll('.segment')).toHaveLength(4);
    });
  });

  it('con «reducir movimiento» todo queda quieto, y en móvil solo salen las columnas marcadas', () => {
    bars().forEach((bar, index) => {
      expect(bar.classList).toContain('motion-reduce:animate-none');
      expect(bar.querySelector('.stock-level')?.classList).toContain('motion-reduce:animate-none');
      expect(bar.classList.contains('hidden')).toBe(!STOCK_BARS[index].showOnMobile);
    });
    expect(fixture.nativeElement.querySelector('.light-sweep').classList).toContain('motion-reduce:hidden');
  });

  it('agrega el grano sobre el panel', () => {
    expect(fixture.nativeElement.querySelector('svg.grain feTurbulence')).not.toBeNull();
  });
});
