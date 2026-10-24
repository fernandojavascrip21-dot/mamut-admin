<template>
  <div class="fixed inset-0 z-50 flex animate-aparecer items-center justify-center bg-black/50 p-5" @click.self="$emit('cancelar')">
    <div role="alertdialog" aria-modal="true" class="w-full max-w-[420px] animate-modal rounded-sm border border-tinta/15 bg-papel p-6 text-tinta">
      <p class="font-cond text-[22px] font-bold leading-tight">{{ mensaje }}</p>
      <div class="mt-6 flex justify-end gap-3">
        <button type="button" class="btn-admin-fantasma" @click="$emit('cancelar')">Cancelar</button>
        <button
          type="button"
          class="btn border border-ladrillo bg-ladrillo text-papel hover:border-[#8d3325] hover:bg-[#8d3325]"
          @click="$emit('confirmar')"
        >
          Eliminar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({ mensaje: { type: String, required: true } })
defineEmits(['confirmar', 'cancelar'])
</script>
