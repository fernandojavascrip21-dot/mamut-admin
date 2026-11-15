export const pesos = (n) =>
  '$' + Number(n || 0).toLocaleString('es-MX')

export const slugificar = (texto) =>
  String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export const lineaDatos = (p) =>
  [p.marca, p.presentacion, p.sabor].filter((v) => v && v !== '—').join(' · ')
