import { HttpErrorResponse } from '@angular/common/http';
import { httpStatus, isNotFound, isOffline } from './http-errors';

describe('http-errors', () => {
  it('status 0 cuenta como sin conexión', () => {
    const error = new HttpErrorResponse({ status: 0 });
    expect(isOffline(error)).toBe(true);
    expect(httpStatus(error)).toBe(0);
  });

  it('un 409 no es sin conexión y conserva su status', () => {
    const error = new HttpErrorResponse({ status: 409 });
    expect(isOffline(error)).toBe(false);
    expect(httpStatus(error)).toBe(409);
  });

  it('un error que no es HTTP no es sin conexión y no tiene status', () => {
    expect(isOffline(new Error('x'))).toBe(false);
    expect(httpStatus(new Error('x'))).toBeNull();
    expect(httpStatus('cualquier cosa')).toBeNull();
  });

  it('isNotFound solo es verdadero con un 404 HTTP', () => {
    expect(isNotFound(new HttpErrorResponse({ status: 404 }))).toBe(true);
    expect(isNotFound(new HttpErrorResponse({ status: 0 }))).toBe(false);
    expect(isNotFound(new Error('404'))).toBe(false);
  });
});
