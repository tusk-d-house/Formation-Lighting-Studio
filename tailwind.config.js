import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const slateVar = (n) => `rgb(var(--slate-${n}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.join(__dirname, "./index.html").replace(/\\/g, '/'),
    path.join(__dirname, "./src/**/*.{js,ts,jsx,tsx}").replace(/\\/g, '/'),
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50: slateVar(50),
          100: slateVar(100),
          200: slateVar(200),
          300: slateVar(300),
          400: slateVar(400),
          500: slateVar(500),
          600: slateVar(600),
          700: slateVar(700),
          800: slateVar(800),
          900: slateVar(900),
          950: slateVar(950),
        },
      },
    },
  },
  plugins: [],
}
