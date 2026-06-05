import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      colors: {
        bg: '#F9F7F5',
        surface: '#FFFFFF',
        sidebar: '#F2EDE8',
        accent: { DEFAULT: '#C0603C', 600: '#A94F2F', tint: '#F6E9E2', tint2: '#FBF1EC' },
        running: '#22C55E',
        attention: '#F59E0B',
        completed: '#16A34A',
      },
    },
  },
  plugins: [],
};
export default config;
