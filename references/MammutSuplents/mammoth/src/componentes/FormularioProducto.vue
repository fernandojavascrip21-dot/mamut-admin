<template>
  <form class="grid gap-5 md:grid-cols-[1fr_300px]" novalidate @submit.prevent="enviar">
    <div class="grid gap-5">
      <div class="grid gap-5 sm:grid-cols-2">
        <div>
          <label class="etiqueta" for="nombre">Nombre *</label>
          <input id="nombre" v-model="datos.nombre" class="campo" :class="{ 'campo-error': errores.nombre }" />
          <span v-if="errores.nombre" class="mensaje-error">{{ errores.nombre }}</span>
        </div>
        <div>
          <label class="etiqueta" for="categoria">Categoría *</label>
          <select id="categoria" v-model="datos.categoria" class="campo" :class="{ 'campo-error': errores.categoria }">
            <option value="">Selecciona una categoría</option>
            <option v-for="c in categoriasReales" :key="c.slug" :value="c.nombre">{{ c.nombre }}</option>
          </select>
          <span v-if="errores.categoria" class="mensaje-error">{{ errores.categoria }}</span>
        </div>
        <div>
          <label class="etiqueta" for="marca">Marca</label>
          <input id="marca" v-model="datos.marca" class="campo" />
        </div>
        <div>
          <label class="etiqueta" for="presentacion">Presentación</label>
          <input id="presentacion" v-model="datos.presentacion" class="campo" placeholder="2 lb, 300 g, 60 servicios" />
        </div>
        <div>
          <label class="etiqueta" for="sabor">Sabor</label>
          <input id="sabor" v-model="datos.sabor" class="campo" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="etiqueta" for="precio">Precio *</label>
            <input id="precio" v-model.number="datos.precio" type="number" min="0" step="1" class="campo" :class="{ 'campo-error': errores.precio }" />
            <span v-if="errores.precio" class="mensaje-error">{{ errores.precio }}</span>
          </div>
          <div>
            <label class="etiqueta" for="existencia">Existencia *</label>
            <input id="existencia" v-model.number="datos.existencia" type="number" min="0" step="1" class="campo" :class="{ 'campo-error': errores.existencia }" />
            <span v-if="errores.existencia" class="mensaje-error">{{ errores.existencia }}</span>
          </div>
        </div>
      </div>

      <div>
        <label class="etiqueta" for="descripcion">Descripción</label>
        <textarea id="descripcion" v-model="datos.descripcion" rows="3" class="campo"></textarea>
      </div>

      <div>
        <label class="etiqueta" for="beneficios">Beneficios (uno por línea)</label>
        <textarea id="beneficios" v-model="beneficiosTexto" rows="3" class="campo"></textarea>
      </div>

      <div>
        <label class="etiqueta" for="modoUso">Modo de uso</label>
        <textarea id="modoUso" v-model="datos.modoUso" rows="2" class="campo"></textarea>
      </div>

      <div class="flex flex-wrap gap-3">
        <button type="submit" class="btn-admin" :disabled="guardando">
          {{ guardando ? 'Guardando...' : 'Guardar producto' }}
        </button>
        <button type="button" class="btn-admin-fantasma" @click="$emit('cancelar')">Cancelar</button>
      </div>
    </div>

    <aside class="grid content-start gap-4">
      <div>
        <label class="etiqueta" for="imagen">URL de imagen *</label>
        <input id="imagen" v-model="datos.imagen" class="campo" :class="{ 'campo-error': errores.imagen }" placeholder="Enlace de Google Drive" />
        <span v-if="errores.imagen" class="mensaje-error">{{ errores.imagen }}</span>
        <span v-if="imagenFallo" class="mensaje-error">La imagen no cargó. Revisa que el archivo sea público.</span>
      </div>

      <div class="aspect-square w-full overflow-hidden rounded-sm border border-tinta/15 bg-white">
        <img :src="urlImagen(datos.imagen)" alt="Vista previa" class="h-full w-full object-cover" @error="fallo" @load="imagenFallo = false" />
      </div>

      <label class="flex items-center gap-3 text-[14px]">
        <input v-model="datos.activo" type="checkbox" class="h-4 w-4 accent-[#C8722C]" />
        Activo (visible en el catálogo público)
      </label>
    </aside>
  </form>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { CATEGORIAS } from '@/datos/categorias'
import { urlImagen, alFallarImagen } from '@/utilidades/imagenes'

const props = defineProps({
  producto: { type: Object, default: null },
  guardando: { type: Boolean, default: false }
})
const emit = defineEmits(['guardar', 'cancelar'])

const vacio = {
  nombre: '', categoria: '', marca: '', presentacion: '', sabor: '',
  precio: null, existencia: null, descripcion: '', modoUso: '', imagen: '', activo: true
}

const datos = reactive({ ...vacio, ...(props.producto || {}) })
const beneficiosTexto = ref(((props.producto && props.producto.beneficios) || []).join('\n'))
const errores = reactive({})
const imagenFallo = ref(false)
const categoriasReales = computed(() => CATEGORIAS.filter((c) => c.slug !== 'todos'))

watch(
  () => props.producto,
  (p) => {
    Object.assign(datos, { ...vacio, ...(p || {}) })
    beneficiosTexto.value = ((p && p.beneficios) || []).join('\n')
  }
)

function fallo(e) {
  imagenFallo.value = true
  alFallarImagen(e)
}

function validar() {
  Object.keys(errores).forEach((k) => delete errores[k])
  if (!datos.nombre.trim()) errores.nombre = 'El nombre es obligatorio'
  if (!datos.categoria) errores.categoria = 'Elige una categoría'
  if (datos.precio === null || datos.precio === '') errores.precio = 'El precio es obligatorio'
  else if (Number(datos.precio) < 0) errores.precio = 'El precio no puede ser negativo'
  if (datos.existencia === null || datos.existencia === '') errores.existencia = 'La existencia es obligatoria'
  else if (Number(datos.existencia) < 0) errores.existencia = 'La existencia no puede ser negativa'
  if (!datos.imagen.trim()) errores.imagen = 'Pega la URL de la foto'
  return Object.keys(errores).length === 0
}

function enviar() {
  if (!validar()) return
  emit('guardar', {
    ...datos,
    precio: Number(datos.precio),
    existencia: Number(datos.existencia),
    beneficios: beneficiosTexto.value.split('\n').map((b) => b.trim()).filter(Boolean)
  })
}
</script>
