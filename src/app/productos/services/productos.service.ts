import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../shared/api-base-url';
import type { Categoria, EditarProductoInput, NuevoProductoInput, Producto, ProductoResumen } from '../interfaces/producto.models';

// Cliente HTTP hacia /api/categories y /api/products. El Bearer token lo agrega
// authInterceptor automáticamente (ver auth/services/auth.interceptor.ts), igual que en
// AuthService; aquí no hace falta leerlo ni mandarlo a mano.
@Injectable({
  providedIn: 'root',
})
export class ProductosService {
  private readonly http = inject(HttpClient);

  listCategorias(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(`${API_BASE_URL}/api/categories`);
  }

  listProductos(): Observable<ProductoResumen[]> {
    return this.http.get<ProductoResumen[]>(`${API_BASE_URL}/api/products`);
  }

  crear(input: NuevoProductoInput): Observable<Producto> {
    return this.http.post<Producto>(`${API_BASE_URL}/api/products`, input);
  }

  obtener(id: number): Observable<Producto> {
    return this.http.get<Producto>(`${API_BASE_URL}/api/products/${id}`);
  }

  actualizar(id: number, input: EditarProductoInput): Observable<Producto> {
    return this.http.patch<Producto>(`${API_BASE_URL}/api/products/${id}`, input);
  }
}
