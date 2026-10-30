import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ComingSoonPageComponent } from './coming-soon-page.component';

function createWithTitle(title: string | undefined): ComponentFixture<ComingSoonPageComponent> {
  TestBed.configureTestingModule({
    imports: [ComingSoonPageComponent],
    providers: [
      {
        provide: ActivatedRoute,
        useValue: {
          data: of({ title }),
          snapshot: { data: { title } },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(ComingSoonPageComponent);
  fixture.detectChanges();
  return fixture;
}

describe('ComingSoonPageComponent', () => {
  it('muestra el título que trae la ruta', () => {
    const fixture = createWithTitle('Stock');
    expect(fixture.nativeElement.textContent).toContain('Próximamente: Stock');
  });

  it('sin título en la ruta, no truena y muestra un texto genérico', () => {
    const fixture = createWithTitle(undefined);
    expect(fixture.nativeElement.textContent).toContain('Próximamente');
  });
});
