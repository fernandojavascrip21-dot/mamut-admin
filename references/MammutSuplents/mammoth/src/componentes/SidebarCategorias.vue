<template>
  <!-- Escritorio: lista vertical · Celular: chips deslizables bajo el header -->
  <nav
    class="sin-barra -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0"
    aria-label="Categorías"
  >
    <p class="mb-3 hidden text-[11px] uppercase tracking-[0.16em] text-tan md:block">Categorías</p>
    <RouterLink
      v-for="cat in categorias"
      :key="cat.slug"
      :to="cat.slug === 'todos' ? { name: 'catalogo' } : { name: 'categoria', params: { slug: cat.slug } }"
      :aria-current="cat.slug === slugActivo ? 'page' : undefined"
      class="flex shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-sm border border-crema/10 border-l-[3px] px-3 py-2.5 text-[14px] transition-colors hover:border-ambar/50 hover:text-crema md:w-full md:whitespace-normal"
      :class="
        cat.slug === slugActivo
          ? 'border-l-ambar bg-ambar/10 font-semibold text-crema'
          : 'border-l-transparent text-tan'
      "
    >
      <span>{{ cat.nombre }}</span>
      <span class="text-[12px] text-tan">{{ cat.conteo }}</span>
    </RouterLink>
  </nav>
</template>

<script setup>
import { RouterLink } from 'vue-router'

defineProps({
  categorias: { type: Array, required: true },
  slugActivo: { type: String, default: 'todos' }
})
</script>
