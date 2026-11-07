import { definePreset } from '@primeuix/themes';
import AuraCheckbox from '@primeuix/themes/aura/checkbox';
import AuraCard from '@primeuix/themes/aura/card';
import AuraConfirmDialog from '@primeuix/themes/aura/confirmdialog';
import AuraDataView from '@primeuix/themes/aura/dataview';
import AuraDialog from '@primeuix/themes/aura/dialog';
import AuraInputText from '@primeuix/themes/aura/inputtext';
import AuraSelect from '@primeuix/themes/aura/select';
import AuraSkeleton from '@primeuix/themes/aura/skeleton';
import AuraTag from '@primeuix/themes/aura/tag';
import AuraToggleSwitch from '@primeuix/themes/aura/toggleswitch';
import AuraToast from '@primeuix/themes/aura/toast';
import type { Preset } from '@primeuix/themes/types';

// Solo los tokens que usan los controles de Aura del piloto, sin sus paletas ajenas a Mammut.
// Las referencias CSS mantienen a styles.css como única fuente de colores y tipografías.
export const MAMMUT_THEME = definePreset({
  primitive: {
    borderRadius: { sm: 'var(--radius-sm)' },
  },
  semantic: {
    typography: {
      fontFamily: 'var(--font-sans)',
      fontSize: '1rem',
      lineHeight: '1.5',
      fontWeight: '400',
    },
    transitionDuration: 'var(--mammut-ui-transition-duration)',
    disabledOpacity: '1',
    iconSize: '1rem',
    anchorGutter: '2px',
    primary: {
      color: 'var(--color-accent)',
      contrastColor: 'var(--color-white)',
      hoverColor: 'var(--color-accent-hover)',
      activeColor: 'var(--color-accent-hover)',
    },
    focusRing: {
      width: '3px',
      style: 'solid',
      color: 'var(--color-accent)',
      offset: '2px',
      shadow: 'none',
    },
    formField: {
      fontSize: '{typography.font.size}',
      fontWeight: '{typography.font.weight}',
      paddingX: '0.875rem',
      paddingY: '0.8125rem',
      sm: { fontSize: '0.875rem', paddingX: '0.75rem', paddingY: '0.625rem' },
      lg: { fontSize: '1.125rem', paddingX: '1rem', paddingY: '0.875rem' },
      transitionDuration: '{transition.duration}',
      shadow: 'none',
      borderRadius: 'var(--radius-xl)',
      background: 'var(--color-white)',
      disabledBackground: 'var(--color-disabled-input)',
      filledBackground: 'var(--color-page)',
      filledHoverBackground: 'var(--color-page)',
      filledFocusBackground: 'var(--color-white)',
      borderColor: 'var(--color-line-strong)',
      hoverBorderColor: 'var(--color-muted)',
      focusBorderColor: 'var(--color-accent)',
      invalidBorderColor: 'var(--color-danger)',
      color: 'var(--color-ink)',
      disabledColor: 'var(--color-faint)',
      placeholderColor: 'var(--color-muted)',
      invalidPlaceholderColor: 'var(--color-danger-text)',
      iconColor: 'var(--color-muted)',
      focusRing: {
        width: '{focus.ring.width}',
        style: '{focus.ring.style}',
        color: '{focus.ring.color}',
        offset: '{focus.ring.offset}',
        shadow: 'none',
      },
    },
    text: {
      color: 'var(--color-ink)',
      hoverColor: 'var(--color-ink)',
      mutedColor: 'var(--color-muted)',
      hoverMutedColor: 'var(--color-ink)',
    },
    content: {
      background: 'var(--color-white)',
      hoverBackground: 'var(--color-page)',
      borderColor: 'var(--color-line)',
      color: 'var(--color-ink)',
      hoverColor: 'var(--color-ink)',
    },
    highlight: {
      background: 'var(--color-accent-2-bg)',
      focusBackground: 'var(--color-accent-2-bg)',
      color: 'var(--color-accent-2-text)',
      focusColor: 'var(--color-accent-2-text)',
    },
    list: {
      padding: '0.25rem',
      gap: '2px',
      header: { padding: '0.5rem 0.875rem' },
      option: {
        fontSize: '{typography.font.size}',
        fontWeight: '{typography.font.weight}',
        padding: '0.75rem 0.875rem',
        borderRadius: 'var(--radius-sm)',
        selectedFontWeight: '600',
        focusBackground: 'var(--color-page)',
        selectedBackground: 'var(--color-accent-2-bg)',
        selectedFocusBackground: 'var(--color-accent-2-bg)',
        color: 'var(--color-ink)',
        focusColor: 'var(--color-ink)',
        selectedColor: 'var(--color-accent-2-text)',
        selectedFocusColor: 'var(--color-accent-2-text)',
      },
      optionGroup: {
        fontSize: '{typography.font.size}',
        fontWeight: '600',
        padding: '0.75rem 0.875rem',
        background: 'var(--color-white)',
        color: 'var(--color-muted)',
      },
    },
    // Fondo que oscurece la página tras un diálogo de PrimeNG: el mismo 55 % de negro que el
    // pop-up propio (`modal-panel`), para que ambos se vean igual.
    mask: {
      transitionDuration: '{transition.duration}',
      background: 'rgb(0 0 0 / 0.55)',
      color: 'var(--color-white)',
    },
    overlay: {
      select: {
        background: 'var(--color-white)',
        borderColor: 'var(--color-line-strong)',
        color: 'var(--color-ink)',
        borderRadius: 'var(--radius-xl)',
        shadow: 'var(--shadow-raised)',
      },
      popover: {
        background: 'var(--color-white)',
        borderColor: 'var(--color-line-strong)',
        color: 'var(--color-ink)',
        borderRadius: 'var(--radius-xl)',
        shadow: 'var(--shadow-raised)',
        padding: '1rem',
      },
      modal: {
        background: 'var(--color-white)',
        borderColor: 'var(--color-line)',
        color: 'var(--color-ink)',
        borderRadius: 'var(--radius-card)',
        shadow: 'var(--shadow-raised)',
        padding: '1.5rem',
      },
    },
  },
  components: {
    inputtext: AuraInputText,
    select: AuraSelect,
    checkbox: AuraCheckbox,
    // Interruptor «Incluir a mis vendedores»: apagado en gris medio (`muted`) porque `line-strong` casi
    // se confunde con el fondo `page`; encendido en el acento. Manija blanca en ambos estados.
    toggleswitch: {
      ...AuraToggleSwitch,
      root: {
        ...AuraToggleSwitch.root,
        background: 'var(--color-muted)',
        // Deshabilitado con los tokens del tema: el de Aura apunta a `surface.600`, que no definimos.
        disabledBackground: '{form.field.disabled.background}',
        hoverBackground: 'var(--color-ink)',
        checkedBackground: 'var(--color-accent)',
        checkedHoverBackground: 'var(--color-accent-hover)',
        focusRing: {
          width: '{focus.ring.width}',
          style: '{focus.ring.style}',
          color: 'var(--color-accent)',
          offset: '{focus.ring.offset}',
          shadow: 'none',
        },
      },
      handle: {
        ...AuraToggleSwitch.handle,
        background: 'var(--color-white)',
        disabledBackground: '{form.field.disabled.color}',
        hoverBackground: 'var(--color-white)',
        checkedBackground: 'var(--color-white)',
        checkedHoverBackground: 'var(--color-white)',
        color: 'var(--color-muted)',
        hoverColor: 'var(--color-muted)',
        checkedColor: 'var(--color-accent)',
        checkedHoverColor: 'var(--color-accent-hover)',
      },
    },
    // Solo se usan las severidades primaria, secundaria y de peligro (más `text` y `outlined.danger`); se omiten las demás de Aura.
    button: {
      root: {
        borderRadius: '{form.field.border.radius}',
        gap: '0.5rem',
        fontSize: '{typography.font.size}',
        paddingX: '1.25rem',
        paddingY: '0.8125rem',
        label: { fontWeight: '700' },
        focusRing: {
          width: '{focus.ring.width}',
          style: '{focus.ring.style}',
          offset: '{focus.ring.offset}',
        },
        transitionDuration: '{transition.duration}',
        primary: {
          background: '{primary.color}',
          hoverBackground: '{primary.hover.color}',
          activeBackground: '{primary.active.color}',
          borderColor: '{primary.color}',
          hoverBorderColor: '{primary.hover.color}',
          activeBorderColor: '{primary.active.color}',
          color: '{primary.contrast.color}',
          hoverColor: '{primary.contrast.color}',
          activeColor: '{primary.contrast.color}',
          focusRing: { color: '{primary.color}', shadow: 'none' },
        },
        secondary: {
          background: 'var(--color-white)',
          hoverBackground: 'var(--color-page)',
          activeBackground: 'var(--color-page)',
          borderColor: 'var(--color-line-strong)',
          hoverBorderColor: 'var(--color-line-strong)',
          activeBorderColor: 'var(--color-line-strong)',
          color: 'var(--color-ink)',
          hoverColor: 'var(--color-ink)',
          activeColor: 'var(--color-ink)',
          focusRing: { color: 'var(--color-accent)', shadow: 'none' },
        },
        // Acciones destructivas de los diálogos («Cerrar sesión», «Descartar»): mismos
        // colores que el botón peligroso de hoy (bg-danger, hover bg-danger-text).
        danger: {
          background: 'var(--color-danger)',
          hoverBackground: 'var(--color-danger-text)',
          activeBackground: 'var(--color-danger-text)',
          borderColor: 'var(--color-danger)',
          hoverBorderColor: 'var(--color-danger-text)',
          activeBorderColor: 'var(--color-danger-text)',
          color: 'var(--color-white)',
          hoverColor: 'var(--color-white)',
          activeColor: 'var(--color-white)',
          focusRing: { color: 'var(--color-danger)', shadow: 'none' },
        },
      },
      // Botón «fantasma» (sustituye a btn-ghost): el óxido conserva contraste sobre crema;
      // accent solo llega a 4.20:1.
      text: {
        primary: {
          color: 'var(--color-accent-hover)',
          hoverBackground: 'var(--color-page)',
          activeBackground: 'var(--color-page)',
        },
      },
      // Peligro con borde («Cerrar sesión», «Reintentar» de los avisos de error).
      outlined: {
        danger: {
          color: 'var(--color-danger)',
          borderColor: 'var(--color-danger)',
          hoverBackground: 'var(--color-danger-bg)',
          activeBackground: 'var(--color-danger-bg)',
        },
      },
    },
    // Solo existen los avisos de éxito y de error (ToastService); se omiten los demás tonos de Aura.
    toast: {
      root: {
        ...AuraToast.root,
        width: '22rem',
        borderRadius: 'var(--radius-xl)',
      },
      icon: AuraToast.icon,
      content: { ...AuraToast.content, padding: '0.875rem 1rem', gap: '0.75rem' },
      text: AuraToast.text,
      summary: { ...AuraToast.summary, fontWeight: '700' },
      detail: AuraToast.detail,
      closeButton: AuraToast.closeButton,
      closeIcon: AuraToast.closeIcon,
      success: {
        background: 'var(--color-success-bg)',
        borderColor: 'var(--color-success-border)',
        color: 'var(--color-success-text)',
        detailColor: 'var(--color-success-text)',
        shadow: 'var(--shadow-raised)',
        closeButton: {
          hoverBackground: 'var(--color-success-border)',
          focusRing: { color: 'var(--color-success-text)', shadow: 'none' },
        },
      },
      error: {
        background: 'var(--color-danger-bg)',
        borderColor: 'var(--color-danger-border)',
        color: 'var(--color-danger-text)',
        detailColor: 'var(--color-danger-text)',
        shadow: 'var(--shadow-raised)',
        closeButton: {
          hoverBackground: 'var(--color-danger-border)',
          focusRing: { color: 'var(--color-danger-text)', shadow: 'none' },
        },
      },
    },
    dialog: {
      ...AuraDialog,
      header: { ...AuraDialog.header, padding: '1.5rem 1.5rem 0.5rem' },
      title: { ...AuraDialog.title, fontWeight: '800' },
      content: { ...AuraDialog.content, padding: '0 1.5rem 1rem' },
      footer: { ...AuraDialog.footer, padding: '0 1.5rem 1.5rem', gap: '0.625rem' },
    },
    confirmdialog: {
      ...AuraConfirmDialog,
      icon: { ...AuraConfirmDialog.icon, color: 'var(--color-danger)' },
    },
    // Menú lateral (M3-t04): la plantilla `#item` propia pinta cada opción, así que el marco, la lista
    // y los elementos se neutralizan (sin fondo, borde, relleno ni sombra). Aura no se importa: sus
    // valores dependen de los tokens `navigation.*` que este preset no define.
    menu: {
      root: {
        background: 'transparent',
        borderColor: 'transparent',
        color: 'inherit',
        borderRadius: '0',
        shadow: 'none',
        transitionDuration: '{transition.duration}',
      },
      list: { padding: '0', gap: '0' },
      item: {
        focusBackground: 'transparent',
        color: 'inherit',
        focusColor: 'inherit',
        padding: '0',
        borderRadius: '0',
        gap: '0',
        icon: { color: 'inherit', focusColor: 'inherit' },
      },
      submenuLabel: {
        padding: '0',
        fontWeight: '700',
        background: 'transparent',
        color: 'inherit',
      },
      separator: { borderColor: 'var(--color-line)' },
    },
    // Tarjetas de «Productos» y «Mis vendedores»: mismo marco que `surface-card` (radio, borde y
    // sombra de marca); el contenido de cada tarjeta pone su propio relleno.
    card: {
      ...AuraCard,
      root: {
        ...AuraCard.root,
        background: 'var(--color-white)',
        borderRadius: 'var(--radius-card)',
        color: 'var(--color-ink)',
        shadow: 'var(--shadow-card)',
      },
      body: { padding: '0', gap: '0' },
    },
    // «Agotado» (contraste, tinta), «Fraccionado» (secundaria, dorado) y «Baja existencia» (advertencia,
    // ámbar); se omiten los demás tonos de Aura.
    tag: {
      root: {
        fontSize: '0.6875rem',
        fontWeight: '700',
        padding: '0.125rem 0.375rem',
        gap: '0.25rem',
        borderRadius: '0.25rem',
        roundedBorderRadius: 'var(--radius-xl)',
      },
      icon: AuraTag.icon,
      secondary: { background: 'var(--color-accent-2-bg)', color: 'var(--color-accent-2-text)' },
      contrast: { background: 'var(--color-ink)', color: 'var(--color-white)' },
      warn: { background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' },
    },
    skeleton: {
      root: {
        ...AuraSkeleton.root,
        borderRadius: '0.5rem',
        background: 'var(--color-line)',
        animationBackground: 'rgb(255 255 255 / 0.45)',
      },
    },
    // Selector Día / Semana / Mes del corte (HU-19): control segmentado; el elegido va en el color de marca.
    selectbutton: {
      root: {
        borderRadius: '{form.field.border.radius}',
        invalidBorderColor: '{form.field.invalid.border.color}',
      },
    },
    togglebutton: {
      root: {
        padding: '0.25rem',
        borderRadius: '{form.field.border.radius}',
        gap: '0.5rem',
        fontWeight: '700',
        fontSize: '{form.field.font.size}',
        background: 'var(--color-page)',
        checkedBackground: 'var(--color-page)',
        hoverBackground: 'var(--color-page)',
        borderColor: 'var(--color-line-strong)',
        checkedBorderColor: 'var(--color-line-strong)',
        color: 'var(--color-muted)',
        hoverColor: 'var(--color-ink)',
        checkedColor: '{primary.contrast.color}',
        disabledBackground: '{form.field.disabled.background}',
        disabledBorderColor: '{form.field.disabled.background}',
        disabledColor: '{form.field.disabled.color}',
        invalidBorderColor: '{form.field.invalid.border.color}',
        focusRing: {
          width: '{focus.ring.width}',
          style: '{focus.ring.style}',
          color: '{focus.ring.color}',
          offset: '{focus.ring.offset}',
          shadow: '{focus.ring.shadow}',
        },
        transitionDuration: '{form.field.transition.duration}',
        sm: { fontSize: '{form.field.sm.font.size}', padding: '0.25rem' },
        lg: { fontSize: '{form.field.lg.font.size}', padding: '0.25rem' },
      },
      icon: {
        color: 'var(--color-muted)',
        hoverColor: 'var(--color-ink)',
        checkedColor: '{primary.contrast.color}',
        disabledColor: '{form.field.disabled.color}',
      },
      content: {
        padding: '0.5rem 0.75rem',
        borderRadius: 'calc({form.field.border.radius} - 0.25rem)',
        checkedBackground: '{primary.color}',
        checkedShadow: 'none',
        sm: { padding: '0.5rem 0.75rem' },
        lg: { padding: '0.5rem 0.75rem' },
      },
    },
    dataview: {
      ...AuraDataView,
      content: { ...AuraDataView.content, background: 'transparent' },
    },
  },
} satisfies Preset);
