import { defineConfig, type WxtViteConfig } from 'wxt';
import tailwindcss from "@tailwindcss/vite";

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'MCQ Generator',
    permissions: ['activeTab', 'scripting', 'storage'],
    host_permissions: ['<all_urls>']
  },
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  } as WxtViteConfig),
});
