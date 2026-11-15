/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        // Paleta tomada del logo de Mammoth Suplements
        fondo: '#15100D',        // marrón casi negro (fondo del logo)
        superficie: '#211915',   // tarjetas y paneles
        'superficie-alt': '#2A211C',
        crema: '#EDE0C8',        // texto principal
        tan: '#A8917A',          // texto secundario
        ambar: '#C8722C',        // acento primario
        oxido: '#8F3B18',        // acento profundo / hover
        oliva: '#7A9A3F',        // disponible
        ladrillo: '#B0402F',     // agotado
        papel: '#F2EBDF',        // fondo del panel de administración
        tinta: '#2A211C'         // texto del panel de administración
      },
      fontFamily: {
        slab: ['"Alfa Slab One"', 'Georgia', 'serif'],
        cond: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
        sans: ['Barlow', 'system-ui', 'sans-serif']
      },
      borderColor: { DEFAULT: 'rgba(237,224,200,0.12)' },
      keyframes: {
        aparecer: { from: { opacity: '0' }, to: { opacity: '1' } },
        subirTarjeta: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        escalarModal: { from: { opacity: '0', transform: 'scale(.97)' }, to: { opacity: '1', transform: 'none' } },
        hojaMovil: { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } }
      },
      animation: {
        aparecer: 'aparecer .18s ease both',
        tarjeta: 'subirTarjeta .22s ease both',
        modal: 'escalarModal .18s ease both',
        hoja: 'hojaMovil .22s ease both'
      }
    }
  },
  plugins: []
}
