import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ToastService } from '@core/toast/toast.service';
import { RestockOrderPageComponent } from './restock-order-page.component';

describe('RestockOrderPageComponent · id de ruta no válido', () => {
  let fixture: ComponentFixture<RestockOrderPageComponent>;
  let httpMock: HttpTestingController;

  const text = () => (document.body.textContent ?? '').replace(/\s+/g, ' ');

  // Un id que no es entero positivo no debe llegar al backend: la página lo trata como «ya no existe».
  it.each(['abc', '0', '-1', '1.5'])('el id «%s» muestra «Este pedido ya no existe» sin pedir nada', async (id) => {
    const params = convertToParamMap({ id });
    await TestBed.configureTestingModule({
      imports: [RestockOrderPageComponent],
      providers: [
        MessageService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: params }, paramMap: of(params) } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RestockOrderPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text()).toContain('Este pedido ya no existe');
    httpMock.expectNone(() => true);
    httpMock.verify();
  });
});
