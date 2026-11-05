/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Google profile photos (Google Sign-In)
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      // Cloudinary (central account)
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      // Firebase Storage (profile photos uploaded via Storage)
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      // Gravatar (fallback avatars)
      {
        protocol: "https",
        hostname: "www.gravatar.com",
      },
    ],
  },
};

export default nextConfig;
