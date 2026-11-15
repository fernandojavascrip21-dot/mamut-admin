<template>
  <div class="min-h-screen bg-papel text-tinta">
    <header class="sticky top-0 z-30 border-b border-tinta/15 bg-papel">
      <div class="mx-auto flex max-w-[1400px] flex-wrap items-center gap-4 px-5 py-3 md:px-7">
        <img :src="logo" alt="Mammoth Suplements" class="h-10 w-10 rounded-full object-cover" />
        <div class="mr-auto">
          <p class="font-cond text-[19px] font-bold leading-none">Panel de administración</p>
          <p class="text-[12.5px] text-tinta/60">{{ sesion.usuario && sesion.usuario.nombre }}</p>
        </div>
        <RouterLink :to="{ name: 'catalogo' }" class="text-[13px] font-semibold text-oxido hover:text-ambar">
          Ver catálogo
        </RouterLink>
        <button type="button" class="btn-admin-fantasma" @click="cerrarSesion">Cerrar sesión</button>
      </div>
    </header>

    <main class="mx-auto max-w-[1400px] px-5 py-7 md:px-7">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useSesionStore } from '@/stores/sesion'
import logo from '@/assets/logo-mammoth.png'

const sesion = useSesionStore()
const router = useRouter()

function cerrarSesion() {
  sesion.salir()
  router.push({ name: 'admin-login' })
}
</script>
