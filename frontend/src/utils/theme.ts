import type { CSSProperties } from 'react'

export interface ThemeColors {
  primary: string
  primaryHover: string
  background: string
  surface: string
  text: string
  textSecondary: string
  border: string
  accent: string
  error: string
  success: string
}

const presets: Record<string, ThemeColors> = {
  warm: {
    primary: '#8B6F47',
    primaryHover: '#725B39',
    background: '#FDFBF7',
    surface: '#FFFFFF',
    text: '#2C2416',
    textSecondary: '#6B5D4F',
    border: '#E0D5C5',
    accent: '#C4956A',
    error: '#B3413A',
    success: '#4A7C59',
  },
  light: {
    primary: '#4A6FA5',
    primaryHover: '#3D5D8A',
    background: '#F8F9FB',
    surface: '#FFFFFF',
    text: '#1A1A2E',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    accent: '#6B8CC7',
    error: '#DC2626',
    success: '#059669',
  },
  dark: {
    primary: '#A78BFA',
    primaryHover: '#8B5CF6',
    background: '#1A1A2E',
    surface: '#252540',
    text: '#F1F0F5',
    textSecondary: '#A0A0B8',
    border: '#3A3A55',
    accent: '#C4B5FD',
    error: '#F87171',
    success: '#6EE7B7',
  },
  cold: {
    primary: '#3B82A0',
    primaryHover: '#2D6A82',
    background: '#F0F4F8',
    surface: '#FFFFFF',
    text: '#1E293B',
    textSecondary: '#64748B',
    border: '#CBD5E1',
    accent: '#5BA3C0',
    error: '#EF4444',
    success: '#10B981',
  },
}

export function getTheme(preset?: string): ThemeColors {
  return presets[preset || 'warm'] || presets.warm
}

export function getConfig(): { phone: string; maxPartySize: number; maxBookingWindow: number; colourPreset: string } {
  const config = window.rbwConfig || {}
  return {
    phone: config.phone || '',
    maxPartySize: config.maxPartySize || 12,
    maxBookingWindow: config.maxBookingWindow || 180,
    colourPreset: config.colourPreset || 'warm',
  }
}

export function styles(theme: ThemeColors) {
  return {
    container: {
      fontFamily: 'inherit',
      color: theme.text,
      maxWidth: 560,
      margin: '0 auto',
      lineHeight: 1.5,
    } as CSSProperties,

    section: {
      marginBottom: 24,
      transition: 'opacity 0.3s ease, max-height 0.4s ease',
    } as CSSProperties,

    sectionTitle: {
      fontSize: 15,
      fontWeight: 600,
      color: theme.textSecondary,
      marginBottom: 12,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
    } as CSSProperties,

    button: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '8px 16px',
      border: `1px solid ${theme.border}`,
      borderRadius: 6,
      background: theme.surface,
      color: theme.text,
      fontSize: 14,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      minWidth: 44,
      minHeight: 44,
    } as CSSProperties,

    buttonSelected: {
      background: theme.primary,
      color: '#FFFFFF',
      borderColor: theme.primary,
    } as CSSProperties,

    buttonHover: {
      borderColor: theme.primary,
      color: theme.primary,
    } as CSSProperties,

    input: {
      display: 'block',
      width: '100%',
      padding: '10px 12px',
      border: `1px solid ${theme.border}`,
      borderRadius: 6,
      fontSize: 14,
      color: theme.text,
      background: theme.surface,
      boxSizing: 'border-box' as const,
      outline: 'none',
      transition: 'border-color 0.15s ease',
    } as CSSProperties,

    inputFocus: {
      borderColor: theme.primary,
    } as CSSProperties,

    label: {
      display: 'block',
      fontSize: 13,
      fontWeight: 500,
      color: theme.textSecondary,
      marginBottom: 4,
    } as CSSProperties,

    helptext: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    } as CSSProperties,

    errorText: {
      fontSize: 12,
      color: theme.error,
      marginTop: 2,
    } as CSSProperties,

    card: {
      background: theme.surface,
      border: `1px solid ${theme.border}`,
      borderRadius: 8,
      padding: 20,
    } as CSSProperties,

    successCard: {
      background: theme.surface,
      border: `2px solid ${theme.success}`,
      borderRadius: 8,
      padding: 24,
      textAlign: 'center' as const,
    } as CSSProperties,

    infoMessage: {
      background: theme.background,
      border: `1px solid ${theme.border}`,
      borderRadius: 6,
      padding: '12px 16px',
      fontSize: 14,
      color: theme.textSecondary,
    } as CSSProperties,

    errorMessage: {
      background: '#FEF2F2',
      border: `1px solid ${theme.error}`,
      borderRadius: 6,
      padding: '12px 16px',
      fontSize: 14,
      color: theme.error,
    } as CSSProperties,

    primaryButton: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px 24px',
      border: 'none',
      borderRadius: 6,
      background: theme.primary,
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'background 0.15s ease',
      minHeight: 44,
    } as CSSProperties,

    spinner: {
      display: 'inline-block',
      width: 20,
      height: 20,
      border: `2px solid ${theme.border}`,
      borderTopColor: theme.primary,
      borderRadius: '50%',
      animation: 'rbw-spin 0.6s linear infinite',
    } as CSSProperties,
  }
}
