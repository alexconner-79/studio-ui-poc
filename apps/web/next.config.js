/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevents Turbopack from bundling these schema-validation packages.
  // They are loaded at runtime from apps/web/node_modules instead,
  // avoiding iCloud-eviction hangs on the monorepo root node_modules.
  serverExternalPackages: ['ajv', 'ajv-formats', 'ajv-keywords'],
};

module.exports = nextConfig;
