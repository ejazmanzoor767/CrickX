/** @type {import('next').NextConfig} */
module.exports = {
  // Never ship a static build while TypeScript errors are being ignored.
  typescript: { ignoreBuildErrors: false },
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'export',
  trailingSlash: true,
};
