import type { NextConfig } from "next";
import os from "os";

// Dynamically fetch all local network IPs to whitelist them for mobile/tablet testing
const localIps: string[] = [];
const interfaces = os.networkInterfaces();
for (const name in interfaces) {
  const iface = interfaces[name];
  if (iface) {
    for (const network of iface) {
      if (network.family === "IPv4" && !network.internal) {
        localIps.push(`${network.address}:3000`);
        localIps.push(`${network.address}:3001`);
      }
    }
  }
}

// Dev origins must NOT have a protocol prefix
const devOrigins = [
  "localhost:3000",
  "localhost:3001",
  "127.0.0.1:3000",
  "127.0.0.1:3001",
  ...localIps,
];

// Server Action origins MUST have http:// or https:// protocol prefix
const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const actionOrigins = [
  ...devOrigins.map(origin => `http://${origin}`),
  publicAppUrl
].filter((url): url is string => Boolean(url));

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
  experimental: {
    serverActions: {
      allowedOrigins: actionOrigins,
    },
  },
};

export default nextConfig;
