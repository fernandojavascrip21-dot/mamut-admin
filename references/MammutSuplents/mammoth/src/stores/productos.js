import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as servicio from '@/servicios/productos'
import { CATEGORIAS } from '@/datos/categorias'

export const useProductosStore = defineStore('productos', () => {
  const productos = ref([])
  const cargando = ref(false)
  const cargado = ref(false)

  async function cargar(forzar = false) {
    if (cargado.value && !forzar) return
    cargando.value = true
    try {
      productos.value = await servicio.listarProductos()
      cargado.value = true
    } finally {
      cargando.value = false
    }
  }

  const publicos = computed(() => productos.value.filter((p) => p.activo))

  const categoriasConConteo = computed(() =>
    CATEGORIAS.map((c) => ({
      ...c,
      conteo:
        c.slug === 'todos'
          ? publicos.value.length
          : publicos.value.filter((p) => p.categoria === c.nombre).length
    }))
  )

  function filtrar({ categoria = 'Todos los productos', busqueda = '', soloActivos = true } = {}) {
    const q = busqueda.trim().toLowerCase()
    return productos.value
      .filter((p) => (soloActivos ? p.activo : true))
      .filter((p) => categoria === 'Todos los productos' || p.categoria === categoria)
      .filter((p) =>
        !q ||
        [p.nombre, p.marca, p.sabor, p.categoria, p.presentacion]
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
  }

  const porId = (id) => productos.value.find((p) => String(p.id) === String(id)) || null

  async function guardar(datos) {
    const guardado = datos.id
      ? await servicio.actualizarProducto(datos.id, datos)
      : await servicio.crearProducto(datos)
    await cargar(true)
    return guardado
  }

  async function eliminar(id) {
    await servicio.eliminarProducto(id)
    await cargar(true)
  }

  return { productos, cargando, cargado, publicos, categoriasConConteo, cargar, filtrar, porId, guardar, eliminar }
})
