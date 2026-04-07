import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#090A0F',
        card: '#131623',
        accent: '#6E8BFF'
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(110, 139, 255, 0.25), 0 12px 40px rgba(0, 0, 0, 0.35)'
      }
    }
  },
  plugins: []
};

export default config;
