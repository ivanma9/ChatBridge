/**
 * Standalone Vite config for the web (Vercel) build.
 * Builds only the renderer — no Electron main/preload, no electron-vite dependency.
 */
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

function injectBaseTag(): Plugin {
  return {
    name: 'inject-base-tag',
    transformIndexHtml() {
      return [{ tag: 'base', attrs: { href: '/' }, injectTo: 'head-prepend' }]
    },
  }
}

function injectReleaseDate(): Plugin {
  const releaseDate = new Date().toISOString().slice(0, 10)
  return {
    name: 'inject-release-date',
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          children: `window.chatbox_release_date="${releaseDate}";`,
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

function replacePlausibleDomain(): Plugin {
  return {
    name: 'replace-plausible-domain',
    transformIndexHtml(html) {
      return html.replace('data-domain="app.chatboxai.app"', 'data-domain="web.chatboxai.app"')
    },
  }
}

function dvhToVh(): Plugin {
  return {
    name: 'dvh-to-vh',
    transform(code, id) {
      if (id.endsWith('.css') || id.endsWith('.scss') || id.endsWith('.sass')) {
        return { code: code.replace(/(\d+)dvh/g, '$1vh'), map: null }
      }
      return null
    },
  }
}

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  plugins: [
    TanStackRouterVite({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: path.resolve(__dirname, 'src/renderer/routes'),
      generatedRouteTree: path.resolve(__dirname, 'src/renderer/routeTree.gen.ts'),
    }),
    react(),
    dvhToVh(),
    injectBaseTag(),
    injectReleaseDate(),
    replacePlausibleDomain(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'src/renderer/dist-web'),
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@ai-sdk') || id.includes('ai/')) return 'vendor-ai'
            if (id.includes('@mantine') || id.includes('@tabler')) return 'vendor-ui'
            if (id.includes('mermaid') || id.includes('d3')) return 'vendor-charts'
          }
        },
      },
    },
  },
  css: {
    modules: { generateScopedName: '[name]__[local]___[hash:base64:5]' },
    postcss: path.resolve(__dirname, 'postcss.config.js'),
  },
  define: {
    'process.type': '"renderer"',
    'process.env.NODE_ENV': '"production"',
    'process.env.CHATBOX_BUILD_TARGET': '"web"',
    'process.env.CHATBOX_BUILD_PLATFORM': '"web"',
    'process.env.CHATBOX_BUILD_CHANNEL': '"web"',
    'process.env.USE_LOCAL_API': '""',
    'process.env.USE_BETA_API': '""',
    'import.meta.env.VITE_BRIDGE_URL': JSON.stringify(
      process.env.VITE_BRIDGE_URL ?? 'https://chatbridge-production-6edb.up.railway.app'
    ),
  },
  optimizeDeps: {
    include: ['mermaid'],
    esbuildOptions: { target: 'es2015' },
  },
})
