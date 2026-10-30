import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginBrandPanelComponent } from './login-brand-panel.component';
import { HEADLINE_WORDS } from './login-brand-panel.constants';

describe('LoginBrandPanelComponent', () => {
  let fixture: ComponentFixture<LoginBrandPanelComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LoginBrandPanelComponent] });
    fixture = TestBed.createComponent(LoginBrandPanelComponent);
    fixture.detectChanges();
  });

  it('muestra el logo con su texto alternativo y el nombre de la marca', () => {
    const logo = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(logo.getAttribute('src')).toBe('logo-mammoth.png');
    expect(logo.alt).toBe('Mammut Supplements');
    expect(fixture.nativeElement.textContent).toContain('Mammut Supplements');
  });

  it('el titular dice «Tu stock, al día.» y entra palabra por palabra', () => {
    const h1 = fixture.nativeElement.querySelector('h1') as HTMLElement;
    const words = Array.from(h1.querySelectorAll('.headline-word')) as HTMLElement[];
    expect(words.map((word) => word.textContent?.trim())).toEqual(['Tu', 'stock,', 'al', 'día.']);
    expect(h1.querySelectorAll('br')).toHaveLength(1);
    words.forEach((word, index) => {
      expect(word.style.animationDelay).toBe(`${HEADLINE_WORDS[index].delaySeconds}s`);
      expect(word.classList).toContain('motion-reduce:animate-none');
    });
  });

  it('monta el fondo animado de columnas de stock', () => {
    expect(fixture.nativeElement.querySelector('app-login-background')).not.toBeNull();
  });
});
