import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/** Thème PrimeNG aux couleurs du Burkina Faso : brun banco en couleur principale, aplats uniquement. */
export const YaabaPreset = definePreset(Aura, {
  primitive: {
    // aucune couleur verte dans l'interface : la palette « green » (succès) devient ocre
    green: {
      50: '#fdf6ec', 100: '#fbe9d0', 200: '#f6d0a0', 300: '#efb46d', 400: '#e69135',
      500: '#c9771f', 600: '#b4581a', 700: '#8a4210', 800: '#6a3410', 900: '#4f270c', 950: '#2b1506',
    },
    emerald: {
      50: '#fdf6ec', 100: '#fbe9d0', 200: '#f6d0a0', 300: '#efb46d', 400: '#e69135',
      500: '#c9771f', 600: '#b4581a', 700: '#8a4210', 800: '#6a3410', 900: '#4f270c', 950: '#2b1506',
    },
    borderRadius: { none: '0', xs: '4px', sm: '8px', md: '10px', lg: '14px', xl: '18px' },
  },
  semantic: {
    primary: {
      50: '#fbf3ee',
      100: '#f8ece3',
      200: '#efd2bd',
      300: '#e0ad8a',
      400: '#c27447',
      500: '#7c3109',
      600: '#6a2907',
      700: '#572206',
      800: '#451b05',
      900: '#341404',
      950: '#1e1611',
    },
    focusRing: { width: '3px', style: 'solid', color: '#fbb117', offset: '2px' },
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff',
          50: '#faf7f2',
          100: '#f3eee5',
          200: '#e6ded1',
          300: '#d5cab8',
          400: '#b4a893',
          500: '#857d71',
          600: '#5c564d',
          700: '#433e37',
          800: '#2d2925',
          900: '#1c1a17',
          950: '#13110e',
        },
      },
      dark: {
        surface: {
          0: '#ffffff',
          50: '#f4efe7',
          100: '#c4bbac',
          200: '#93897a',
          300: '#6b6356',
          400: '#4a4339',
          500: '#353029',
          600: '#2f2a23',
          700: '#25211b',
          800: '#1c1915',
          900: '#13110e',
          950: '#0c0a08',
        },
      },
    },
  },
});
