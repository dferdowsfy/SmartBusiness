import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Government PDFs and reviewed mappings are runtime inputs, not generated
  // worksheets. Keep them in the Next.js service bundle for every server route.
  outputFileTracingIncludes: {
    "/*": ["RealForms/**/*", "form-mappings/**/*"],
  },
};

export default nextConfig;
