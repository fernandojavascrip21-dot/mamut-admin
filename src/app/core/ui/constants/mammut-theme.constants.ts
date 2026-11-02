import { definePreset } from '@primeuix/themes';
import AuraCheckbox from '@primeuix/themes/aura/checkbox';
import AuraConfirmDialog from '@primeuix/themes/aura/confirmdialog';
import AuraDataView from '@primeuix/themes/aura/dataview';
import AuraDialog from '@primeuix/themes/aura/dialog';
import AuraInputText from '@primeuix/themes/aura/inputtext';
import AuraSelect from '@primeuix/themes/aura/select';
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
    dataview: {
      ...AuraDataView,
      content: { ...AuraDataView.content, background: 'transparent' },
    },
  },
} satisfies Preset);
