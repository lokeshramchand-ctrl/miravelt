import { ImageResponse } from "next/og";
import { renderSocialCard, socialImageSize } from "@/lib/social-image";
import { DESCRIPTION, SITE_NAME, TAGLINE } from "@/lib/brand";

export const size = socialImageSize;
export const contentType = "image/png";
export const alt = `${SITE_NAME} — ${TAGLINE} ${DESCRIPTION}`;

export default function Image() {
  return new ImageResponse(renderSocialCard(), size);
}
