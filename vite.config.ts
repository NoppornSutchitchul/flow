import os from 'node:os'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function localLanIp(): string | undefined {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    if (!ifaces) continue
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return undefined
}

function mobileDevUrlsPlugin(): Plugin {
  return {
    name: 'flow-mobile-dev-urls',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const ip = localLanIp()
        const port = server.config.server.port ?? 5173
        if (!ip) return
        // Vite already prints Network URL; repeat for visibility when scanning logs.
        server.config.logger.info(
          `\n  Phone (same Wi‑Fi): http://${ip}:${port}/\n`,
          { clear: false, timestamp: false },
        )
      })
    },
  }
}

const lanIp = process.env.VITE_DEV_LAN_IP || localLanIp()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), mobileDevUrlsPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-dom") || id.includes("/react/")) return "vendor-react";
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("i18next") || id.includes("react-i18next")) return "vendor-i18n";
          if (id.includes("lucide-react")) return "vendor-icons";
        },
      },
    },
  },
  server: {
    host: true,
    port: Number(process.env.VITE_PORT) || 5173,
    strictPort: false,
    // Allow opening dev app from phone via LAN IP (not only localhost).
    allowedHosts: true,
    hmr: lanIp
      ? {
          host: lanIp,
          protocol: 'ws',
        }
      : undefined,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
