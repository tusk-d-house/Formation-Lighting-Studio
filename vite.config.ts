import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const slateVar = (n: number) => `rgb(var(--slate-${n}) / <alpha-value>)`;

export default defineConfig({
  plugins: [react()],
  base: './',
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          content: [
            path.join(__dirname, './index.html').replace(/\\/g, '/'),
            path.join(__dirname, './src/**/*.{js,ts,jsx,tsx}').replace(/\\/g, '/'),
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
        }),
        autoprefixer(),
      ],
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
