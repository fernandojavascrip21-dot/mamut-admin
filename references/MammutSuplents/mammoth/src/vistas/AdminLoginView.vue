<template>
  <div class="grano relative flex min-h-screen items-center justify-center bg-fondo px-5 py-12">
    <div class="relative z-[2] w-full max-w-[400px] rounded-sm border border-crema/10 bg-superficie p-8">
      <img :src="logo" alt="Mammoth Suplements" class="mx-auto h-[76px] w-[76px] rounded-full object-cover" />
      <h1 class="mt-5 text-center font-cond text-[24px] font-bold text-crema">Acceso al panel</h1>

      <form class="mt-6 grid gap-4" novalidate @submit.prevent="entrar">
        <div>
          <label class="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-tan" for="correo">Correo electrónico</label>
          <input
            id="correo"
            v-model="correo"
            type="email"
            autocomplete="username"
            class="w-full rounded-sm border border-crema/15 bg-fondo px-3 py-2.5 text-[14.5px] text-crema focus:border-ambar focus:outline-none"
          />
        </div>
        <div>
          <label class="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-tan" for="contrasena">Contraseña</label>
          <input
            id="contrasena"
            v-model="contrasena"
            type="password"
            autocomplete="current-password"
            class="w-full rounded-sm border border-crema/15 bg-fondo px-3 py-2.5 text-[14.5px] text-crema focus:border-ambar focus:outline-none"
          />
        </div>

        <p v-if="sesion.error" role="alert" class="rounded-sm border border-ladrillo/50 bg-ladrillo/15 px-3 py-2 text-[13px] text-[#E39C90]">
          {{ sesion.error }}
        </p>

        <button type="submit" class="btn-primario mt-1 w-full" :disabled="sesion.entrando">
          {{ sesion.entrando ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>

      <RouterLink :to="{ name: 'catalogo' }" class="mt-6 block text-center text-[13px] text-tan hover:text-crema">
        Volver al catálogo
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
import { useSesionStore } from '@/stores/sesion'
import logo from '@/assets/logo-mammoth.png'

const sesion = useSesionStore()
const router = useRouter()
const route = useRoute()
const correo = ref('')
const contrasena = ref('')

async function entrar() {
  const ok = await sesion.entrar(correo.value, contrasena.value)
  if (ok) router.push(route.query.redirigir || { name: 'admin-productos' })
}
</script>
