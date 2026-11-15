<template>
  <div class="min-h-screen bg-fondo">
    <header class="grano sticky top-0 z-40 overflow-hidden border-b border-crema/10 bg-fondo">
      <!-- Marca de agua: la insignia al 4%, una sola vez -->
      <img
        :src="logo"
        alt=""
        aria-hidden="true"
        class="pointer-events-none absolute -right-16 -top-32 h-[520px] w-[520px] opacity-[0.04]"
      />
      <div class="relative z-[2] mx-auto flex max-w-[1520px] flex-wrap items-center gap-4 px-5 py-3.5 md:px-7">
        <RouterLink :to="{ name: 'catalogo' }" class="shrink-0 leading-none">
          <img :src="logo" alt="Mammoth Suplements" class="h-[52px] w-[52px] rounded-full object-cover" />
        </RouterLink>

        <div class="order-3 w-full md:order-none md:flex-1">
          <BarraBusqueda v-model="interfaz.busqueda" />
        </div>

        <a :href="enlaceTienda()" target="_blank" rel="noopener" class="btn-fantasma ml-auto shrink-0 md:ml-0">
          <IconoWhatsApp class="h-4 w-4 text-oliva" />
          <span class="hidden sm:inline">WhatsApp</span>
        </a>
      </div>
    </header>

    <RouterView />

    <footer class="border-t border-crema/10 px-5 py-8 text-center text-[12.5px] text-tan md:px-7">
      Mammoth Suplements · Pedidos por WhatsApp
    </footer>
  </div>
</template>

<script setup>
import { RouterLink, RouterView } from 'vue-router'
import BarraBusqueda from '@/componentes/BarraBusqueda.vue'
import IconoWhatsApp from '@/componentes/IconoWhatsApp.vue'
import { enlaceTienda } from '@/utilidades/whatsapp'
import { useInterfazStore } from '@/stores/interfaz'
import logo from '@/assets/logo-mammoth.png'

const interfaz = useInterfazStore()
</script>
