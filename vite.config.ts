import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

// The dev server's hot reload needs a websocket to localhost; a production build must not allow it.
function stripDevOnlyCsp(): Plugin {
  return {
    name: 'strip-dev-only-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(/ ws:\/\/localhost:\*/g, '');
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), stripDevOnlyCsp()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
