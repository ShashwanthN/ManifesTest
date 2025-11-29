import { defineConfig, type WxtViteConfig } from 'wxt';
import tailwindcss from "@tailwindcss/vite";

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'ManifesTest',
    short_name: 'ManifesTest',
    description: 'AI-powered test generator that creates quizzes from any webpage content. Generate MCQs, True/False, and Fill-in-the-blank questions instantly.',
    version: '1.0.0',
    homepage_url: 'https://github.com/ShashwanthN/ManifesTest',
    permissions: ['activeTab', 'scripting', 'storage'],
    host_permissions: ['<all_urls>'],
    action: {
      default_popup: 'popup/index.html',
      default_title: 'ManifesTest - Generate Tests from Web Pages',
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
        128: 'icon/128.png'
      }
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png'
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'"
    },
    minimum_chrome_version: '109'
  },
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  } as WxtViteConfig),
});
