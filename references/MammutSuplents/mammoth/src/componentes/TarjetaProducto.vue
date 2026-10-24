<template>
  <article
    class="group flex animate-tarjeta cursor-pointer flex-col overflow-hidden rounded-sm border border-crema/10 bg-superficie transition-colors hover:border-ambar"
    role="button"
    tabindex="0"
    :aria-label="'Ver detalle de ' + producto.nombre"
    @click="$emit('abrir', producto)"
    @keydown.enter.prevent="$emit('abrir', producto)"
    @keydown.space.prevent="$emit('abrir', producto)"
  >
    <div class="relative aspect-square overflow-hidden bg-superficie-alt">
      <img
        :src="urlImagen(producto.imagen)"
        :alt="producto.nombre"
        loading="lazy"
        class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        @error="alFallarImagen"
      />
      <InsigniaExistencia :existencia="producto.existencia" class="absolute left-2.5 top-2.5" />
    </div>

    <div class="flex flex-1 flex-col gap-2 p-4">
      <h2 class="nombre-producto text-crema">{{ producto.nombre }}</h2>
      <p class="dato">{{ lineaDatos(producto) }}</p>
      <p class="precio mt-1 text-[23px] text-crema">{{ pesos(producto.precio) }}</p>
      <div class="mt-2" @click.stop>
        <BotonWhatsApp :producto="producto" />
      </div>
    </div>
  </article>
</template>

<script setup>
import InsigniaExistencia from '@/componentes/InsigniaExistencia.vue'
import BotonWhatsApp from '@/componentes/BotonWhatsApp.vue'
import { pesos, lineaDatos } from '@/utilidades/formato'
import { urlImagen, alFallarImagen } from '@/utilidades/imagenes'

defineProps({ producto: { type: Object, required: true } })
defineEmits(['abrir'])
</script>
