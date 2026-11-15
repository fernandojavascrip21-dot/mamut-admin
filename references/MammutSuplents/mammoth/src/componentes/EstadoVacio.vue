<template>
  <div class="animate-aparecer rounded-sm border border-dashed border-crema/20 px-6 py-16 text-center">
    <p class="font-cond text-[24px] font-bold text-crema">{{ titulo }}</p>
    <p class="mt-1.5 text-[14px] text-tan">{{ texto }}</p>
    <RouterLink v-if="mostrarBoton" :to="{ name: 'catalogo' }" class="btn-primario mt-6" @click="$emit('accion')">
      Ver todos los productos
    </RouterLink>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'

defineEmits(['accion'])
defineProps({
  titulo: { type: String, required: true },
  texto: { type: String, default: '' },
  mostrarBoton: { type: Boolean, default: true }
})
</script>
