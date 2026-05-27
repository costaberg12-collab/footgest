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
      // Use process.cwd() for better compatibility with production environments
      const baseDir = process.cwd();
      const clientTemplate = path.resolve(
        baseDir,
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
  // Use process.cwd() for better compatibility with production environments
  const baseDir = process.cwd();
  const distPath = path.resolve(baseDir, "dist/public");
  
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
    console.error(`Current directory: ${process.cwd()}`);
    console.error(`dist path resolved to: ${distPath}`);
  }

  // Inject environment variables into index.html at runtime
  // This is done via a custom middleware that only handles index.html
  const injectEnvVars = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Only intercept requests for index.html
    const originalSend = res.send;
    res.send = function(data: any) {
      if (typeof data === 'string' && data.includes('</head>')) {
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

        data = data.replace("</head>", `${envScript}</head>`);
      }
      return originalSend.call(this, data);
    };
    next();
  };

  app.use(injectEnvVars);

  // Serve static files
  app.use(express.static(distPath));

  // Fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"), (err) => {
      if (err) {
        res.status(404).send("Not found");
      }
    });
  });
}
