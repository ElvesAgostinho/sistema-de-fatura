import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Segoe UI"', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['"Segoe UI"', 'var(--font-display)', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
        md: 'var(--radius)',
        sm: 'var(--radius-sm)',
      },
      colors: {
        background: 'rgba(var(--background), <alpha-value>)',
        foreground: 'rgba(var(--foreground), <alpha-value>)',
        card: { DEFAULT: 'rgba(var(--card), <alpha-value>)', foreground: 'rgba(var(--card-foreground), <alpha-value>)' },
        popover: { DEFAULT: 'rgba(var(--popover), <alpha-value>)', foreground: 'rgba(var(--popover-foreground), <alpha-value>)' },
        primary: { DEFAULT: 'rgba(var(--primary), <alpha-value>)', foreground: 'rgba(var(--primary-foreground), <alpha-value>)' },
        secondary: { DEFAULT: 'rgba(var(--secondary), <alpha-value>)', foreground: 'rgba(var(--secondary-foreground), <alpha-value>)' },
        muted: { DEFAULT: 'rgba(var(--muted), <alpha-value>)', foreground: 'rgba(var(--muted-foreground), <alpha-value>)' },
        accent: { DEFAULT: 'rgba(var(--accent), <alpha-value>)', foreground: 'rgba(var(--accent-foreground), <alpha-value>)' },
        destructive: { DEFAULT: 'rgba(var(--destructive), <alpha-value>)', foreground: 'rgba(var(--destructive-foreground), <alpha-value>)' },
        success: { DEFAULT: 'rgba(var(--success), <alpha-value>)', foreground: 'rgba(var(--success-foreground), <alpha-value>)' },
        warning: { DEFAULT: 'rgba(var(--warning), <alpha-value>)', foreground: 'rgba(var(--warning-foreground), <alpha-value>)' },
        border: 'rgba(var(--border), <alpha-value>)',
        input: 'rgba(var(--input), <alpha-value>)',
        ring: 'rgba(var(--ring), <alpha-value>)',
        chart: {
          '1': 'rgba(var(--chart-1), <alpha-value>)',
          '2': 'rgba(var(--chart-2), <alpha-value>)',
          '3': 'rgba(var(--chart-3), <alpha-value>)',
          '4': 'rgba(var(--chart-4), <alpha-value>)',
          '5': 'rgba(var(--chart-5), <alpha-value>)',
        },
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
