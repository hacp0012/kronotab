/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./sidepanel.html",
    "./kanban.html",
    "./timer.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Google Sans"',
          '"Google Sans Text"',
          '"Product Sans"',
          '"Plus Jakarta Sans"',
          'Roboto',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        mono: [
          '"Google Sans Mono"',
          '"Roboto Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },
      colors: {
        md: {
          surface: 'var(--md-surface)',
          'surface-container': 'var(--md-surface-container)',
          'surface-high': 'var(--md-surface-high)',
          'on-surface': 'var(--md-on-surface)',
          'on-surface-variant': 'var(--md-on-surface-variant)',
          outline: 'var(--md-outline)',
          'outline-subtle': 'var(--md-outline-subtle)',
          primary: 'var(--md-primary)',
          'on-primary': 'var(--md-on-primary)',
          'primary-container': 'var(--md-primary-container)',
          'on-primary-container': 'var(--md-on-primary-container)',
        },
      },
    },
  },
  plugins: [],
};
