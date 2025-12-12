import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
  return {
    plugins: [react()],
    define: {
      // Polyfill process.env for the Google GenAI SDK usage
      'process.env.GEMINI_API_KEY': JSON.stringify(apiKey)
    }
  };
});
