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

  it('dibuja una columna por cada barra de stock, con sus cuatro segmentos', () => {
    expect(bars()).toHaveLength(STOCK_BARS.length);
    for (const bar of bars()) expect(bar.querySelectorAll('.segment')).toHaveLength(4);
  });

  it('cada columna toma su altura, duración y retraso de las constantes', () => {
    const first = bars()[0];
    expect(first.style.height).toBe(`${STOCK_BARS[0].heightPercent}%`);
    expect(first.style.animationDuration).toBe(`${STOCK_BARS[0].durationSeconds}s`);
    expect(first.style.animationDelay).toBe(`${STOCK_BARS[0].delaySeconds}s`);
  });

  it('las columnas se detienen con «reducir movimiento» y en móvil solo salen las marcadas', () => {
    bars().forEach((bar, index) => {
      expect(bar.classList).toContain('motion-reduce:animate-none');
      expect(bar.classList.contains('hidden')).toBe(!STOCK_BARS[index].showOnMobile);
    });
  });
});
