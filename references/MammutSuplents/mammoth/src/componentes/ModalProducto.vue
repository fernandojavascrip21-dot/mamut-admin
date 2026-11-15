<template>
  <div
    class="fixed inset-0 z-50 flex animate-aparecer items-end justify-center bg-black/75 sm:items-center sm:p-5"
    @click.self="$emit('cerrar')"
  >
    <div
      ref="dialogo"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      :aria-label="producto.nombre"
      class="relative flex h-[90vh] w-full animate-hoja flex-col overflow-hidden rounded-t-lg border border-crema/15 bg-superficie sm:h-auto sm:max-h-[88vh] sm:max-w-[940px] sm:animate-modal sm:rounded-sm"
      @keydown.tab="atraparFoco"
    >
      <button
        type="button"
        aria-label="Cerrar"
        class="absolute right-3 top-3 z-10 h-9 w-9 rounded-sm border border-crema/15 bg-fondo/80 text-crema hover:border-ambar"
        @click="$emit('cerrar')"
      >
        ✕
      </button>

      <div class="flex-1 overflow-y-auto">
        <div class="flex flex-col sm:flex-row">
          <div class="aspect-square w-full shrink-0 bg-superficie-alt sm:w-[46%]">
            <img
              :src="urlImagen(producto.imagen)"
              :alt="producto.nombre"
              class="h-full w-full object-cover"
              @error="alFallarImagen"
            />
          </div>

          <div class="flex flex-1 flex-col gap-3.5 p-7 sm:p-8">
            <InsigniaExistencia :existencia="producto.existencia" class="self-start" />
            <h2 class="font-cond text-[32px] font-bold leading-tight text-crema">{{ producto.nombre }}</h2>
            <p class="text-[13.5px] text-tan">{{ lineaDatos(producto) }}</p>
            <p class="precio text-[34px] text-crema">{{ pesos(producto.precio) }}</p>
            <p class="text-[13px]" :class="estado.color">{{ estado.texto }}</p>
            <p class="mt-1 text-[14.5px] leading-relaxed text-crema">{{ producto.descripcion }}</p>

            <div v-if="producto.beneficios && producto.beneficios.length" class="mt-2">
              <p class="mb-2 text-[11px] uppercase tracking-[0.16em] text-tan">Beneficios</p>
              <ul class="flex flex-col gap-1.5">
                <li v-for="b in producto.beneficios" :key="b" class="flex gap-2.5 text-[14px] leading-snug text-crema">
                  <span class="text-ambar">—</span><span>{{ b }}</span>
                </li>
              </ul>
            </div>

            <div v-if="producto.modoUso" class="mt-2 border-t border-crema/10 pt-4">
              <p class="mb-1.5 text-[11px] uppercase tracking-[0.16em] text-tan">Modo de uso</p>
              <p class="text-[14px] leading-relaxed text-crema">{{ producto.modoUso }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Botón fijo, siempre visible aunque se haga scroll -->
      <div class="shrink-0 border-t border-crema/10 bg-superficie p-4 pb-6 sm:px-8">
        <BotonWhatsApp :producto="producto" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import InsigniaExistencia from '@/componentes/InsigniaExistencia.vue'
import BotonWhatsApp from '@/componentes/BotonWhatsApp.vue'
import { pesos, lineaDatos } from '@/utilidades/formato'
import { urlImagen, alFallarImagen } from '@/utilidades/imagenes'
import { estadoExistencia } from '@/utilidades/existencia'

const props = defineProps({ producto: { type: Object, required: true } })
const emit = defineEmits(['cerrar'])

const dialogo = ref(null)
const estado = computed(() => estadoExistencia(props.producto.existencia))
let elementoPrevio = null

const alPresionarTecla = (e) => {
  if (e.key === 'Escape') emit('cerrar')
}

function atraparFoco(e) {
  const focoables = dialogo.value.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])')
  if (!focoables.length) return
  const primero = focoables[0]
  const ultimo = focoables[focoables.length - 1]
  if (e.shiftKey && document.activeElement === primero) {
    e.preventDefault()
    ultimo.focus()
  } else if (!e.shiftKey && document.activeElement === ultimo) {
    e.preventDefault()
    primero.focus()
  }
}

onMounted(() => {
  elementoPrevio = document.activeElement
  document.addEventListener('keydown', alPresionarTecla)
  document.body.style.overflow = 'hidden'
  dialogo.value && dialogo.value.focus()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', alPresionarTecla)
  document.body.style.overflow = ''
  // Devuelve el foco a la tarjeta que abrió el modal
  elementoPrevio && elementoPrevio.focus && elementoPrevio.focus()
})
</script>
