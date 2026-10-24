import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { CREDENCIALES_DEMO } from '@/config'

const LLAVE = 'mammoth.sesion'

export const useSesionStore = defineStore('sesion', () => {
  const usuario = ref(JSON.parse(localStorage.getItem(LLAVE) || 'null'))
  const error = ref('')
  const entrando = ref(false)
  const autenticado = computed(() => !!usuario.value)

  async function entrar(correo, contrasena) {
    entrando.value = true
    error.value = ''
    try {
      // BACKEND: const { data } = await api.post('/auth/login', { correo, contrasena })
      //          guardar data.token (httpOnly cookie o localStorage) y adjuntarlo en cada request
      await new Promise((r) => setTimeout(r, 350))
      const ok =
        correo.trim().toLowerCase() === CREDENCIALES_DEMO.correo &&
        contrasena === CREDENCIALES_DEMO.contrasena
      if (!ok) {
        error.value = 'Correo o contraseña incorrectos'
        return false
      }
      usuario.value = { correo: CREDENCIALES_DEMO.correo, nombre: CREDENCIALES_DEMO.nombre, token: 'demo-token' }
      localStorage.setItem(LLAVE, JSON.stringify(usuario.value))
      return true
    } finally {
      entrando.value = false
    }
  }

  function salir() {
    // BACKEND: await api.post('/auth/logout') y limpiar el token
    usuario.value = null
    localStorage.removeItem(LLAVE)
  }

  return { usuario, error, entrando, autenticado, entrar, salir }
})
