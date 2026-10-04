import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.29.144", "127.0.0.1", "localhost"],
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "web-push"],
  async redirects() {
    return [
      { source: "/try", destination: "/still", permanent: false },
      { source: "/try/:path*", destination: "/still/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
