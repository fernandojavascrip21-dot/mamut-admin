import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import type { Category, UpdateProductInput, CreateProductInput, Product, ProductSummary } from '../interfaces/product.models';

// Cliente HTTP hacia /api/categories y /api/products. El Bearer token lo agrega
// authInterceptor automáticamente (ver auth/services/auth.interceptor.ts), igual que en
// AuthService; aquí no hace falta leerlo ni mandarlo a mano.
@Injectable({
  providedIn: 'root',
})
export class ProductsService {
  private readonly http = inject(HttpClient);

  listCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${API_BASE_URL}/api/categories`);
  }

  listProducts(): Observable<ProductSummary[]> {
    return this.http.get<ProductSummary[]>(`${API_BASE_URL}/api/products`);
  }

  create(input: CreateProductInput): Observable<Product> {
    return this.http.post<Product>(`${API_BASE_URL}/api/products`, input);
  }

  getById(id: number): Observable<Product> {
    return this.http.get<Product>(`${API_BASE_URL}/api/products/${id}`);
  }

  update(id: number, input: UpdateProductInput): Observable<Product> {
    return this.http.patch<Product>(`${API_BASE_URL}/api/products/${id}`, input);
  }
}
