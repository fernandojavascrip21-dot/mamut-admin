<template>
  <div class="overflow-x-auto rounded-sm border border-tinta/15 bg-white">
    <table class="w-full min-w-[860px] border-collapse text-left text-[14px] text-tinta">
      <thead>
        <tr class="border-b border-tinta/15 bg-papel text-[11px] uppercase tracking-[0.12em] text-tinta/60">
          <th class="px-4 py-3 font-semibold">Foto</th>
          <th class="px-4 py-3 font-semibold">Nombre</th>
          <th class="px-4 py-3 font-semibold">Categoría</th>
          <th class="px-4 py-3 text-right font-semibold">Precio</th>
          <th class="px-4 py-3 text-right font-semibold">Existencia</th>
          <th class="px-4 py-3 font-semibold">Estado</th>
          <th class="px-4 py-3 text-right font-semibold">Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="p in productos"
          :key="p.id"
          class="border-b border-tinta/10 last:border-0"
          :class="Number(p.existencia) === 0 ? 'bg-ladrillo/[0.07]' : ''"
        >
          <td class="px-4 py-2.5">
            <img
              :src="urlImagen(p.imagen)"
              :alt="p.nombre"
              class="h-11 w-11 rounded-sm border border-tinta/10 object-cover"
              @error="alFallarImagen"
            />
          </td>
          <td class="px-4 py-2.5">
            <span class="font-cond text-[17px] font-bold">{{ p.nombre }}</span>
            <span class="block text-[12.5px] text-tinta/55">{{ lineaDatos(p) }}</span>
          </td>
          <td class="px-4 py-2.5 text-tinta/70">{{ p.categoria }}</td>
          <td class="px-4 py-2.5 text-right">{{ pesos(p.precio) }}</td>
          <td class="px-4 py-2.5 text-right" :class="Number(p.existencia) === 0 ? 'font-semibold text-ladrillo' : ''">
            {{ p.existencia }}
          </td>
          <td class="px-4 py-2.5">
            <span
              class="insignia"
              :class="p.activo ? 'border-oliva/45 bg-oliva/15 text-[#4E661F]' : 'border-tinta/25 bg-tinta/10 text-tinta/60'"
            >
              {{ p.activo ? 'Activo' : 'Inactivo' }}
            </span>
          </td>
          <td class="whitespace-nowrap px-4 py-2.5 text-right">
            <RouterLink
              :to="{ name: 'admin-editar', params: { id: p.id } }"
              class="text-[13px] font-semibold text-oxido hover:text-ambar"
            >
              Editar
            </RouterLink>
            <button
              type="button"
              class="ml-4 text-[13px] font-semibold text-ladrillo hover:underline"
              @click="$emit('eliminar', p)"
            >
              Eliminar
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-if="!productos.length" class="px-4 py-12 text-center text-[14px] text-tinta/60">
      No encontramos productos con esos filtros.
    </p>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'
import { pesos, lineaDatos } from '@/utilidades/formato'
import { urlImagen, alFallarImagen } from '@/utilidades/imagenes'

defineProps({ productos: { type: Array, required: true } })
defineEmits(['eliminar'])
</script>
