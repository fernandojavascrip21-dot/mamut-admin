import type { RestockOrderLookup } from '../interfaces/restock.models';

// Resultado de cargar el detalle: `failed` si la petición falló (se ofrece «Reintentar»); si no,
// el `lookup` que devolvió el servicio (incluido el 404 como «ya no existe»).
export type RestockOrderLoad = { failed: true } | { failed: false; lookup: RestockOrderLookup };
