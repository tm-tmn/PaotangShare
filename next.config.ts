import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its own data files at runtime, so keep it out of the bundle; ship the Thai fonts with the route
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: { "/api/report": ["./assets/fonts/**"] },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
