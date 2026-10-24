import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ComingSoonComponent } from './coming-soon.component';

function createWithTitle(title: string | undefined): ComponentFixture<ComingSoonComponent> {
  TestBed.configureTestingModule({
    imports: [ComingSoonComponent],
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
  const fixture = TestBed.createComponent(ComingSoonComponent);
  fixture.detectChanges();
  return fixture;
}

describe('ComingSoonComponent', () => {
  it('muestra el título que trae la ruta', () => {
    const fixture = createWithTitle('Stock');
    expect(fixture.nativeElement.textContent).toContain('Próximamente: Stock');
  });

  it('sin título en la ruta, no truena y muestra un texto genérico', () => {
    const fixture = createWithTitle(undefined);
    expect(fixture.nativeElement.textContent).toContain('Próximamente');
  });
});
