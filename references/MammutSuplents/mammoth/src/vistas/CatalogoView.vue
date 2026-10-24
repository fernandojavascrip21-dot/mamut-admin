<template>
  <main class="mx-auto flex max-w-[1520px] flex-col gap-7 px-5 py-6 md:flex-row md:items-start md:gap-9 md:px-7 md:py-8">
    <aside class="md:sticky md:top-[104px] md:w-[230px] md:shrink-0">
      <SidebarCategorias :categorias="store.categoriasConConteo" :slug-activo="slugActivo" />
    </aside>

    <section class="min-w-0 flex-1">
      <div class="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b border-crema/10 pb-3.5">
        <h1 class="titulo-seccion text-crema">{{ nombreCategoria }}</h1>
        <span class="text-[13.5px] text-tan">{{ conteoTexto }}</span>
      </div>

      <div v-if="store.cargando" class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <EsqueletoTarjeta v-for="n in 8" :key="n" />
      </div>

      <div v-else-if="lista.length" class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaProducto
          v-for="p in lista"
          :key="p.id"
          :producto="p"
          @abrir="seleccionado = p"
        />
      </div>

      <EstadoVacio
        v-else-if="interfaz.busqueda.trim()"
        titulo="No encontramos productos con ese nombre"
        texto="Revisa la escritura o busca por marca, sabor o presentación."
        @accion="interfaz.busqueda = ''"
      />

      <EstadoVacio
        v-else
        titulo="Todavía no hay productos en esta categoría"
        texto="Estamos surtiendo. Escríbenos por WhatsApp y te avisamos cuando lleguen."
      />
    </section>

    <ModalProducto v-if="seleccionado" :producto="seleccionado" @cerrar="seleccionado = null" />
  </main>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import SidebarCategorias from '@/componentes/SidebarCategorias.vue'
import TarjetaProducto from '@/componentes/TarjetaProducto.vue'
import ModalProducto from '@/componentes/ModalProducto.vue'
import EsqueletoTarjeta from '@/componentes/EsqueletoTarjeta.vue'
import EstadoVacio from '@/componentes/EstadoVacio.vue'
import { useProductosStore } from '@/stores/productos'
import { useInterfazStore } from '@/stores/interfaz'
import { nombreDesdeSlug } from '@/datos/categorias'

const route = useRoute()
const store = useProductosStore()
const interfaz = useInterfazStore()
const seleccionado = ref(null)

const slugActivo = computed(() => route.params.slug || 'todos')
const nombreCategoria = computed(() => nombreDesdeSlug(slugActivo.value))

const lista = computed(() =>
  store.filtrar({ categoria: nombreCategoria.value, busqueda: interfaz.busqueda })
)

const conteoTexto = computed(() =>
  lista.value.length === 1 ? '1 producto' : lista.value.length + ' productos'
)

watch(slugActivo, () => { seleccionado.value = null })
onMounted(() => store.cargar())
</script>
