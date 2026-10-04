// Client-safe helpers for rendering Cloudinary media with automatic format
// (AVIF/WebP) and quality, sized to what the browser actually needs.

import type { ImageLoaderProps } from "next/image";

const UPLOAD_SEGMENT = /\/(image|video)\/upload\//;

export const isCloudinary = (src: string) => src.startsWith("https://res.cloudinary.com/") && UPLOAD_SEGMENT.test(src);

/** next/image loader: lets Cloudinary resize + convert instead of Vercel's optimiser. */
export function cloudinaryLoader({ src, width, quality }: ImageLoaderProps): string {
  const t = `f_auto,q_${quality ?? "auto"},c_limit,w_${width},dpr_1`;
  return src.replace(UPLOAD_SEGMENT, (m) => `${m}${t}/`);
}

/** Optimised video delivery (auto codec/format/quality, capped width). */
export function cloudinaryVideo(src: string, width = 1280): string {
  return isCloudinary(src) ? src.replace(UPLOAD_SEGMENT, (m) => `${m}q_auto,vc_auto,c_limit,w_${width}/`) : src;
}

/** Poster frame for a Cloudinary video. */
export function cloudinaryPoster(src: string): string | undefined {
  return isCloudinary(src) ? src.replace(UPLOAD_SEGMENT, (m) => `${m}so_1,f_auto,q_auto,w_900/`).replace(/\.[a-z0-9]+$/i, ".jpg") : undefined;
}
