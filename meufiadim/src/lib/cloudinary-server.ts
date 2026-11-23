// Cloudinary Node SDK (v2) configuration for server-side operations
// Used in Server Actions and Route Handlers (Node.js runtime only)
// Reads credentials from process.env (configured in .env / .env.local)
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };
