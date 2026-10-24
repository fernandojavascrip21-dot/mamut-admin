<template>
  <div class="relative w-full">
    <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] leading-none text-tan">⌕</span>
    <input
      :value="modelValue"
      type="search"
      :placeholder="placeholder"
      :aria-label="placeholder"
      class="w-full rounded-sm border border-crema/10 bg-superficie py-2.5 pl-9 pr-3 text-[14.5px] text-crema placeholder:text-tan focus:border-ambar focus:outline-none"
      @input="$emit('update:modelValue', $event.target.value)"
    />
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Buscar proteína, marca, sabor...' }
})
defineEmits(['update:modelValue'])
</script>
