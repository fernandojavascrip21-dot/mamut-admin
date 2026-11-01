import { definePreset } from '@primeuix/themes';
import AuraBase from '@primeuix/themes/aura/base';
import AuraCheckbox from '@primeuix/themes/aura/checkbox';
import AuraInputText from '@primeuix/themes/aura/inputtext';
import AuraSelect from '@primeuix/themes/aura/select';

// Solo la base y los controles del piloto: los demás presets no deben aumentar el arranque.
// Las referencias CSS mantienen a styles.css como única fuente de colores y tipografías.
export const MAMMUT_THEME = definePreset(AuraBase, {
  semantic: {
    typography: {
      fontFamily: 'var(--font-sans)',
      fontSize: '1rem',
      lineHeight: '1.5',
    },
    transitionDuration: 'var(--mammut-ui-transition-duration)',
    primary: {
      50: 'color-mix(in srgb, var(--color-accent) 6%, var(--color-white))',
      100: 'color-mix(in srgb, var(--color-accent) 12%, var(--color-white))',
      200: 'color-mix(in srgb, var(--color-accent) 24%, var(--color-white))',
      300: 'color-mix(in srgb, var(--color-accent) 38%, var(--color-white))',
      400: 'color-mix(in srgb, var(--color-accent) 70%, var(--color-white))',
      500: 'var(--color-accent)',
      600: 'var(--color-accent-hover)',
      700: 'color-mix(in srgb, var(--color-accent-hover) 80%, var(--color-ink))',
      800: 'color-mix(in srgb, var(--color-accent-hover) 60%, var(--color-ink))',
      900: 'color-mix(in srgb, var(--color-accent-hover) 40%, var(--color-ink))',
      950: 'color-mix(in srgb, var(--color-accent-hover) 20%, var(--color-ink))',
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
      paddingX: '0.875rem',
      paddingY: '0.8125rem',
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
      option: {
        padding: '0.75rem 0.875rem',
        focusBackground: 'var(--color-page)',
        selectedBackground: 'var(--color-accent-2-bg)',
        selectedFocusBackground: 'var(--color-accent-2-bg)',
        color: 'var(--color-ink)',
        focusColor: 'var(--color-ink)',
        selectedColor: 'var(--color-accent-2-text)',
        selectedFocusColor: 'var(--color-accent-2-text)',
      },
    },
    overlay: {
      select: {
        background: 'var(--color-white)',
        borderColor: 'var(--color-line-strong)',
        color: 'var(--color-ink)',
        borderRadius: 'var(--radius-xl)',
        shadow: 'var(--shadow-raised)',
      },
    },
  },
  components: {
    inputtext: AuraInputText,
    select: AuraSelect,
    checkbox: AuraCheckbox,
    // El piloto solo usa botones primarios y secundarios; omitir las otras severidades de Aura.
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
      },
    },
  },
});
