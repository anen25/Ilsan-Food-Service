import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');

    // Debug: Log Firebase env vars during build (v2)
    console.log('🔥 Firebase ENV check v2:', {
      apiKey: process.env.VITE_FIREBASE_API_KEY ? '✅ SET' : '❌ MISSING',
      projectId: process.env.VITE_FIREBASE_PROJECT_ID ? '✅ SET' : '❌ MISSING',
    });

    return {
      server: {
        port: 3001,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        // Firebase environment variables from Cloudflare (using custom globals)
        '__FIREBASE_API_KEY__': JSON.stringify(process.env.VITE_FIREBASE_API_KEY || ''),
        '__FIREBASE_AUTH_DOMAIN__': JSON.stringify(process.env.VITE_FIREBASE_AUTH_DOMAIN || ''),
        '__FIREBASE_PROJECT_ID__': JSON.stringify(process.env.VITE_FIREBASE_PROJECT_ID || ''),
        '__FIREBASE_STORAGE_BUCKET__': JSON.stringify(process.env.VITE_FIREBASE_STORAGE_BUCKET || ''),
        '__FIREBASE_MESSAGING_SENDER_ID__': JSON.stringify(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''),
        '__FIREBASE_APP_ID__': JSON.stringify(process.env.VITE_FIREBASE_APP_ID || ''),
        '__FIREBASE_VAPID_KEY__': JSON.stringify(process.env.VITE_FIREBASE_VAPID_KEY || ''),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
