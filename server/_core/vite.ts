import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // import.meta.dirname em producao eh /app/dist (apos esbuild bundle)
  // Precisamos de /app/dist/public que eh import.meta.dirname/public
  const distPath = path.resolve(import.meta.dirname, "public");
  
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
    console.error(`Current directory: ${process.cwd()}`);
    console.error(`import.meta.dirname: ${import.meta.dirname}`);
  }

  // Serve static files (CSS, JS, images, etc.)
  app.use(express.static(distPath, {
    setHeaders: (res, path) => {
      // Ensure proper MIME types
      if (path.endsWith('.js')) {
        res.set('Content-Type', 'application/javascript');
      } else if (path.endsWith('.css')) {
        res.set('Content-Type', 'text/css');
      }
    }
  }));

  // Handle HTML requests and inject environment variables
  app.get('/', (req, res) => {
    const indexPath = path.resolve(distPath, 'index.html');
    try {
      let html = fs.readFileSync(indexPath, 'utf-8');
      
      // Inject environment variables as a global script
      const envVars = {
        VITE_APP_ID: process.env.VITE_APP_ID || "",
        VITE_OAUTH_PORTAL_URL: process.env.VITE_OAUTH_PORTAL_URL || "",
        VITE_FRONTEND_FORGE_API_URL: process.env.VITE_FRONTEND_FORGE_API_URL || "",
        VITE_FRONTEND_FORGE_API_KEY: process.env.VITE_FRONTEND_FORGE_API_KEY || "",
        VITE_APP_TITLE: process.env.VITE_APP_TITLE || "",
        VITE_APP_LOGO: process.env.VITE_APP_LOGO || "",
        VITE_ANALYTICS_ENDPOINT: process.env.VITE_ANALYTICS_ENDPOINT || "",
        VITE_ANALYTICS_WEBSITE_ID: process.env.VITE_ANALYTICS_WEBSITE_ID || "",
      };

      const envScript = `<script>
        window.__ENV__ = ${JSON.stringify(envVars)};
      </script>`;

      html = html.replace('</head>', `${envScript}</head>`);
      res.set('Content-Type', 'text/html').send(html);
    } catch (e) {
      console.error('Error serving index.html:', e);
      res.status(500).send('Internal Server Error');
    }
  });

  // Fall through to index.html for SPA routing
  app.use('*', (req, res) => {
    const indexPath = path.resolve(distPath, 'index.html');
    try {
      let html = fs.readFileSync(indexPath, 'utf-8');
      
      // Inject environment variables as a global script
      const envVars = {
        VITE_APP_ID: process.env.VITE_APP_ID || "",
        VITE_OAUTH_PORTAL_URL: process.env.VITE_OAUTH_PORTAL_URL || "",
        VITE_FRONTEND_FORGE_API_URL: process.env.VITE_FRONTEND_FORGE_API_URL || "",
        VITE_FRONTEND_FORGE_API_KEY: process.env.VITE_FRONTEND_FORGE_API_KEY || "",
        VITE_APP_TITLE: process.env.VITE_APP_TITLE || "",
        VITE_APP_LOGO: process.env.VITE_APP_LOGO || "",
        VITE_ANALYTICS_ENDPOINT: process.env.VITE_ANALYTICS_ENDPOINT || "",
        VITE_ANALYTICS_WEBSITE_ID: process.env.VITE_ANALYTICS_WEBSITE_ID || "",
      };

      const envScript = `<script>
        window.__ENV__ = ${JSON.stringify(envVars)};
      </script>`;

      html = html.replace('</head>', `${envScript}</head>`);
      res.set('Content-Type', 'text/html').send(html);
    } catch (e) {
      console.error('Error serving index.html:', e);
      res.status(500).send('Internal Server Error');
    }
  });
}
