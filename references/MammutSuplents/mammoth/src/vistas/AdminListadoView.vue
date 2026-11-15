<template>
  <div>
    <div class="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="font-cond text-[28px] font-bold leading-none">Productos</h1>
        <p class="mt-1 text-[13px] text-tinta/60">{{ lista.length }} de {{ store.productos.length }} productos</p>
      </div>
      <RouterLink :to="{ name: 'admin-nuevo' }" class="btn-admin">Agregar producto</RouterLink>
    </div>

    <div class="mb-4 flex flex-wrap gap-3">
      <input v-model="busqueda" class="campo max-w-[320px]" placeholder="Buscar por nombre o marca" />
      <select v-model="categoria" class="campo max-w-[220px]">
        <option v-for="c in CATEGORIAS" :key="c.slug" :value="c.nombre">{{ c.nombre }}</option>
      </select>
    </div>

    <p v-if="store.cargando" class="py-12 text-center text-[14px] text-tinta/60">Cargando productos...</p>
    <TablaProductos v-else :productos="lista" @eliminar="porEliminar = $event" />

    <DialogoConfirmar
      v-if="porEliminar"
      :mensaje="'¿Eliminar ' + porEliminar.nombre + '? Esta acción no se puede deshacer.'"
      @cancelar="porEliminar = null"
      @confirmar="eliminar"
    />

    <NotificacionToast :mensaje="aviso" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import TablaProductos from '@/componentes/TablaProductos.vue'
import DialogoConfirmar from '@/componentes/DialogoConfirmar.vue'
import NotificacionToast from '@/componentes/NotificacionToast.vue'
import { useProductosStore } from '@/stores/productos'
import { CATEGORIAS } from '@/datos/categorias'

const store = useProductosStore()
const route = useRoute()
const busqueda = ref('')
const categoria = ref('Todos los productos')
const porEliminar = ref(null)
const aviso = ref('')

const lista = computed(() =>
  store.filtrar({ categoria: categoria.value, busqueda: busqueda.value, soloActivos: false })
)

function mostrarAviso(texto) {
  aviso.value = texto
  setTimeout(() => (aviso.value = ''), 2600)
}

async function eliminar() {
  const nombre = porEliminar.value.nombre
  await store.eliminar(porEliminar.value.id)
  porEliminar.value = null
  mostrarAviso(nombre + ' eliminado')
}

onMounted(() => {
  store.cargar()
  if (route.query.guardado) mostrarAviso('Producto guardado')
})
</script>
