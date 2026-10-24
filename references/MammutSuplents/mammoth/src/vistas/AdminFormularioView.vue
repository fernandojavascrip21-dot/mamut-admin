<template>
  <div>
    <div class="mb-6">
      <RouterLink :to="{ name: 'admin-productos' }" class="text-[13px] text-tinta/60 hover:text-oxido">
        ← Volver al listado
      </RouterLink>
      <h1 class="mt-2 font-cond text-[28px] font-bold leading-none">
        {{ esEdicion ? 'Editar producto' : 'Agregar producto' }}
      </h1>
    </div>

    <p v-if="cargandoProducto" class="py-12 text-center text-[14px] text-tinta/60">Cargando producto...</p>

    <FormularioProducto
      v-else
      :producto="producto"
      :guardando="guardando"
      @guardar="guardar"
      @cancelar="router.push({ name: 'admin-productos' })"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import FormularioProducto from '@/componentes/FormularioProducto.vue'
import { useProductosStore } from '@/stores/productos'

const route = useRoute()
const router = useRouter()
const store = useProductosStore()

const producto = ref(null)
const guardando = ref(false)
const cargandoProducto = ref(true)
const esEdicion = computed(() => !!route.params.id)

async function guardar(datos) {
  guardando.value = true
  try {
    await store.guardar(esEdicion.value ? { ...datos, id: route.params.id } : datos)
    router.push({ name: 'admin-productos', query: { guardado: '1' } })
  } finally {
    guardando.value = false
  }
}

onMounted(async () => {
  await store.cargar()
  if (esEdicion.value) producto.value = store.porId(route.params.id)
  cargandoProducto.value = false
})
</script>
