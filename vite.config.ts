import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'dev-api-middleware',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/api/admin/verify')) {
            const authHeader = req.headers.authorization || '';
            if (!authHeader.startsWith('Bearer ')) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing token' }));
              return;
            }
            try {
              const token = authHeader.split('Bearer ')[1].trim();
              const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
              const email = (payload.email || '').toLowerCase().trim();
              const isAdmin = email === 'madhurzamutsha@gmail.com' || Boolean(payload.admin);
              if (isAdmin) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ authorized: true, email }));
              } else {
                res.statusCode = 403;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Access Denied: You do not have administrator permissions for ClassMate.', email }));
              }
            } catch {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Invalid token' }));
            }
            return;
          }
          next();
        });
      },
    },
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/messaging'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});

