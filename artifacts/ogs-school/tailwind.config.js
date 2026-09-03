/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Brand palette for the SaaS marketing/onboarding/platform-admin
      // surfaces (Landing, Onboarding, SaaS Admin). The rest of the school
      // portal keeps its existing emerald/slate design system.
      colors: {
        brand: {
          ink: '#0F262E',
          'ink-light': '#173840',
          mint: '#9FF3EF',
          violet: '#B679F5',
          indigo: '#2A0A5C',
        },
        // "app-*" tokens back the redesigned shell (Layout/Sidebar/Header)
        // and Dashboard — CSS variables defined in index.css, switched by
        // the `.dark` class (ThemeContext) and, for app-primary/-secondary,
        // overridable per-tenant at runtime (Enterprise "white_labeling"
        // appearance settings). Deliberately namespaced under "app-" rather
        // than reusing bare color names so none of the existing
        // emerald/slate pages are affected by this — they keep working
        // exactly as before.
        app: {
          bg: 'var(--app-bg)',
          surface: 'var(--app-surface)',
          'surface-alt': 'var(--app-surface-alt)',
          border: 'var(--app-border)',
          text: 'var(--app-text)',
          'text-muted': 'var(--app-text-muted)',
          primary: 'var(--app-primary)',
          'primary-light': 'var(--app-primary-light)',
          secondary: 'var(--app-secondary)',
        },
      },
      keyframes: {
        'brand-float': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(3%, -4%) scale(1.05)' },
          '66%': { transform: 'translate(-3%, 3%) scale(0.97)' },
        },
        'brand-fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'brand-gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'brand-glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(182,121,245,0.45)' },
          '50%': { boxShadow: '0 0 0 10px rgba(182,121,245,0)' },
        },
      },
      animation: {
        'brand-float': 'brand-float 14s ease-in-out infinite',
        'brand-float-slow': 'brand-float 20s ease-in-out infinite',
        'brand-fade-up': 'brand-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both',
        'brand-gradient-x': 'brand-gradient-x 6s ease infinite',
        'brand-glow-pulse': 'brand-glow-pulse 2.4s ease-in-out infinite',
      },
      backgroundSize: {
        '200%': '200% 200%',
      },
    },
  },
  plugins: [],
};
