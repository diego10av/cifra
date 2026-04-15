import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel serverless: explicitly bundle PDFKit's font metric files (.afm)
  // and the JSON data alongside the function. Without this, requests fail with
  //   ENOENT: '/var/task/node_modules/pdfkit/js/data/Helvetica.afm'
  outputFileTracingIncludes: {
    '/api/declarations/[id]/pdf': [
      './node_modules/pdfkit/js/data/**/*',
    ],
  },
};

export default nextConfig;
