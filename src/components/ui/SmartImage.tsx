"use client";

import Image, { type ImageProps } from "next/image";
import { cloudinaryLoader, isCloudinary } from "@/lib/media";

/**
 * Drop-in for next/image: Cloudinary assets are resized/converted by
 * Cloudinary's CDN (f_auto,q_auto); anything else uses Next's optimiser.
 */
export default function SmartImage(props: ImageProps) {
  const src = typeof props.src === "string" ? props.src : "";
  return <Image {...props} loader={isCloudinary(src) ? cloudinaryLoader : undefined} alt={props.alt} />;
}
