// Máximo de un integer de Postgres: más piezas que eso no caben en un movimiento.
export const MAX_QTY = 2_147_483_647;

// Textos de los estados vacíos de «Dejar a vendedor» (spec T-26, §3.1).
export const CREATE_DELIVERY_EMPTY_TEXTS = {
  'no-sellers': {
    title: 'Aún no tienes vendedores',
    text: 'Da de alta a un vendedor para dejarle producto.',
    primary: 'Dar de alta vendedor',
  },
  'no-units': {
    title: 'No hay piezas en la bodega',
    text: 'Da de alta un producto con sus piezas para poder dejárselo a un vendedor.',
    primary: 'Nuevo producto',
  },
  close: 'Cerrar',
} as const;

// Destinos de los botones principales. «Nuevo producto» se repite aquí porque la feature `stock`
// tiene la suya y una feature no importa a otra.
export const NEW_SELLER_URL = '/admin/vendedores/nuevo';
export const NEW_PRODUCT_URL = '/admin/productos/nuevo';
