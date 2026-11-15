<template>
  <span class="insignia" :class="estado.clase">{{ estado.etiqueta }}</span>
</template>

<script setup>
import { computed } from 'vue'
import { estadoExistencia } from '@/utilidades/existencia'

const props = defineProps({ existencia: { type: [Number, String], default: 0 } })
const estado = computed(() => estadoExistencia(props.existencia))
</script>
