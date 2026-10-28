import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../shared/api-base-url';

// Sube la foto a POST /api/products/photo (el backend la sube a Supabase Storage con la
// llave de servicio — specs/M1-hu04-dar-de-alta-producto/spec.md §8: la subida directa desde
// Angular se intentó primero, pero el servicio de Storage de Supabase rechazaba el JWT del
// admin por una razón que no se pudo diagnosticar). El Bearer token lo agrega
// authInterceptor solo, igual que en productos.service.ts.
@Injectable({
  providedIn: 'root',
})
export class ProductoFotosService {
  private readonly http = inject(HttpClient);

  subir(file: File): Observable<string> {
    const form = new FormData();
    form.set('file', file);
    return this.http
      .post<{ url: string }>(`${API_BASE_URL}/api/products/photo`, form)
      .pipe(map((res) => res.url));
  }
}
