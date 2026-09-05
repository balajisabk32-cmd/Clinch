const rgb = (v) => `rgb(var(${v}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // FRONTEND.md: curated typography only. No Inter / Roboto / Open Sans.
        display: ['Outfit', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Channel form so Tailwind's `/alpha` modifier works on every token.
        bg: rgb('--bg'),
        surface: { DEFAULT: rgb('--surface'), 2: rgb('--surface-2'), 3: rgb('--surface-3') },
        fg: { DEFAULT: rgb('--fg'), 2: rgb('--fg-2'), 3: rgb('--fg-3'), 4: rgb('--fg-4') },
        // Hairlines are literal rgba; never take an alpha modifier.
        line: { DEFAULT: 'var(--line)', 2: 'var(--line-2)' },
        accent: {
          DEFAULT: rgb('--accent'), 2: rgb('--accent-2'),
          3: rgb('--accent-3'), wash: rgb('--accent-wash'),
        },
        band: {
          auto: rgb('--band-auto'), autoWash: rgb('--band-auto-wash'),
          manager: rgb('--band-manager'), managerWash: rgb('--band-manager-wash'),
          finance: rgb('--band-finance'), financeWash: rgb('--band-finance-wash'),
        },
      },
      borderColor: { DEFAULT: 'var(--line)' },
      boxShadow: {
        lift: 'var(--lift-1)',
        'lift-lg': 'var(--lift-2)',
        glow: 'var(--glow)',
      },
      letterSpacing: { eyebrow: '0.2em' },
    },
  },
  plugins: [],
}
