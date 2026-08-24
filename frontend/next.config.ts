import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The official PDFs and their field mappings live at the repository root,
  // outside the Next.js project. Include them in every server trace that may
  // load a government-form artifact at runtime.
  outputFileTracingRoot: path.join(__dirname, ".."),
  outputFileTracingIncludes: {
    "/*": ["../RealForms/**/*", "../form-mappings/**/*"],
  },
};

export default nextConfig;
