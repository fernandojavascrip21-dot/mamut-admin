import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { AuthService } from '../../auth/services/auth.service';
import { createSupabaseClient } from '../../shared/supabase-client';

const BUCKET = 'product-photos';

// Sube la foto directo a Supabase Storage, sin pasar por el backend. Manda el token de sesión
// del administrador para que la política de insert del bucket (solo admins autenticados,
// specs/M1-hu04-dar-de-alta-producto/spec.md §2 y §5) la deje pasar; sin sesión válida, el
// `upload` falla y quien llama lo trata igual que el estado `offline` (aviso + Reintentar).
@Injectable({
  providedIn: 'root',
})
export class ProductoFotosService {
  private readonly auth = inject(AuthService);

  subir(file: File): Observable<string> {
    const path = `${Date.now()}-${file.name}`;
    const client = createSupabaseClient(this.auth.accessToken ?? undefined);
    return from(client.storage.from(BUCKET).upload(path, file)).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return client.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl;
      }),
    );
  }
}
