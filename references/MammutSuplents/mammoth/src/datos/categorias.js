export const CATEGORIAS = [
  { nombre: 'Todos los productos', slug: 'todos' },
  { nombre: 'Proteínas', slug: 'proteinas' },
  { nombre: 'Pre-entrenos', slug: 'pre-entrenos' },
  { nombre: 'Creatinas', slug: 'creatinas' },
  { nombre: 'Vitaminas', slug: 'vitaminas' },
  { nombre: 'Aminoácidos', slug: 'aminoacidos' }
]

export const nombreDesdeSlug = (slug) =>
  (CATEGORIAS.find((c) => c.slug === slug) || CATEGORIAS[0]).nombre

export const slugDesdeNombre = (nombre) =>
  (CATEGORIAS.find((c) => c.nombre === nombre) || CATEGORIAS[0]).slug
