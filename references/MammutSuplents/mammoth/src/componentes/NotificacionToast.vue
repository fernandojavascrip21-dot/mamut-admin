<template>
  <div
    v-if="mensaje"
    role="status"
    class="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 animate-aparecer rounded-sm border border-ambar bg-tinta px-5 py-3 text-[14px] font-semibold text-papel"
  >
    {{ mensaje }}
  </div>
</template>

<script setup>
defineProps({ mensaje: { type: String, default: '' } })
</script>
