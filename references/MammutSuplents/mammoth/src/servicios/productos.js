import semilla from '@/datos/productos.json'

/**
 * Única capa de lectura y escritura de productos.
 * Hoy: productos.json como semilla + localStorage como persistencia.
 * Mañana: sustituir el cuerpo de cada función por la llamada real
 * (REST o Supabase) sin tocar los componentes ni los stores.
 */

const LLAVE = 'mammoth.productos'
const espera = (ms = 220) => new Promise((r) => setTimeout(r, ms))

function leerLocal() {
  try {
    const crudo = localStorage.getItem(LLAVE)
    return crudo ? JSON.parse(crudo) : null
  } catch {
    return null
  }
}

function escribirLocal(productos) {
  localStorage.setItem(LLAVE, JSON.stringify(productos))
}

export async function listarProductos() {
  // BACKEND: const { data } = await api.get('/productos'); return data
  await espera()
  let productos = leerLocal()
  if (!productos) {
    productos = semilla.map((p) => ({ ...p }))
    escribirLocal(productos)
  }
  return productos
}

export async function obtenerProducto(id) {
  // BACKEND: const { data } = await api.get('/productos/' + id); return data
  const productos = await listarProductos()
  return productos.find((p) => String(p.id) === String(id)) || null
}

export async function crearProducto(datos) {
  // BACKEND: const { data } = await api.post('/productos', datos); return data
  await espera(180)
  const productos = leerLocal() || []
  const id = productos.reduce((max, p) => Math.max(max, Number(p.id)), 0) + 1
  const nuevo = { ...datos, id }
  escribirLocal([...productos, nuevo])
  return nuevo
}

export async function actualizarProducto(id, datos) {
  // BACKEND: const { data } = await api.put('/productos/' + id, datos); return data
  await espera(180)
  const productos = (leerLocal() || []).map((p) =>
    String(p.id) === String(id) ? { ...p, ...datos, id: p.id } : p
  )
  escribirLocal(productos)
  return productos.find((p) => String(p.id) === String(id))
}

export async function eliminarProducto(id) {
  // BACKEND: await api.delete('/productos/' + id)
  await espera(150)
  escribirLocal((leerLocal() || []).filter((p) => String(p.id) !== String(id)))
}

/** Solo para desarrollo: vuelve a dejar el catálogo como viene en productos.json */
export async function restablecerCatalogo() {
  escribirLocal(semilla.map((p) => ({ ...p })))
  return listarProductos()
}
