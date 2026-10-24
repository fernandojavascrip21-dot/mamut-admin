<template>
  <a
    :href="href"
    target="_blank"
    rel="noopener"
    :class="[agotado ? 'btn-fantasma' : 'btn-primario', bloque ? 'w-full' : '']"
  >
    <IconoWhatsApp class="h-4 w-4" />
    {{ texto }}
  </a>
</template>

<script setup>
import { computed } from 'vue'
import IconoWhatsApp from '@/componentes/IconoWhatsApp.vue'
import { enlaceProducto, textoBoton } from '@/utilidades/whatsapp'

const props = defineProps({
  producto: { type: Object, required: true },
  bloque: { type: Boolean, default: true }
})

const href = computed(() => enlaceProducto(props.producto))
const texto = computed(() => textoBoton(props.producto))
const agotado = computed(() => Number(props.producto.existencia) === 0)
</script>
