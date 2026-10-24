import { defineStore } from 'pinia'
import { ref } from 'vue'

// Estado compartido entre el header y el catálogo (el buscador vive en el header)
export const useInterfazStore = defineStore('interfaz', () => {
  const busqueda = ref('')
  return { busqueda }
})
