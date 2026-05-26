/**
 * Vite plugin to inject VITE_* environment variables at build time
 * This ensures Railway's runtime env vars are available in the bundle
 */

export default function viteEnvPlugin() {
  return {
    name: 'vite-env-injection',
    resolveId(id) {
      if (id === 'virtual-env') {
        return id;
      }
    },
    load(id) {
      if (id === 'virtual-env') {
        // Generate env object from process.env
        const envVars = {
          VITE_APP_ID: process.env.VITE_APP_ID || '',
          VITE_OAUTH_PORTAL_URL: process.env.VITE_OAUTH_PORTAL_URL || '',
          VITE_FRONTEND_FORGE_API_URL: process.env.VITE_FRONTEND_FORGE_API_URL || '',
          VITE_FRONTEND_FORGE_API_KEY: process.env.VITE_FRONTEND_FORGE_API_KEY || '',
          VITE_APP_TITLE: process.env.VITE_APP_TITLE || '',
          VITE_APP_LOGO: process.env.VITE_APP_LOGO || '',
          VITE_ANALYTICS_ENDPOINT: process.env.VITE_ANALYTICS_ENDPOINT || '',
          VITE_ANALYTICS_WEBSITE_ID: process.env.VITE_ANALYTICS_WEBSITE_ID || '',
        };

        return `export default ${JSON.stringify(envVars)};`;
      }
    },
    transform(code) {
      // Replace import.meta.env.VITE_* with actual values
      let transformed = code;
      
      const envVars = [
        'VITE_APP_ID',
        'VITE_OAUTH_PORTAL_URL',
        'VITE_FRONTEND_FORGE_API_URL',
        'VITE_FRONTEND_FORGE_API_KEY',
        'VITE_APP_TITLE',
        'VITE_APP_LOGO',
        'VITE_ANALYTICS_ENDPOINT',
        'VITE_ANALYTICS_WEBSITE_ID',
      ];

      envVars.forEach((varName) => {
        const value = process.env[varName] || '';
        const regex = new RegExp(`import\\.meta\\.env\\.${varName}`, 'g');
        transformed = transformed.replace(regex, JSON.stringify(value));
      });

      return {
        code: transformed,
      };
    },
  };
}
// Force rebuild - Tue May 26 06:13:31 EDT 2026
