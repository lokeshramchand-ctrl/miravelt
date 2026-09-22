import {
  BRAND_BACKGROUND,
  BRAND_INK,
  BRAND_ORANGE,
  DESCRIPTION,
  MONOGRAM_PATH,
  SITE_NAME,
  TAGLINE,
} from "@/lib/brand";

export const socialImageSize = { width: 1200, height: 630 };

export function renderSocialCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: BRAND_INK,
        padding: "80px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <svg width="56" height="56" viewBox="0 0 33 33" fill="none">
          <path d={MONOGRAM_PATH} fill={BRAND_BACKGROUND} />
        </svg>
        <span
          style={{
            fontSize: 32,
            color: BRAND_BACKGROUND,
            fontWeight: 600,
            letterSpacing: -1,
          }}
        >
          {SITE_NAME}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            fontSize: 64,
            color: BRAND_BACKGROUND,
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: -2,
          }}
        >
          {TAGLINE}
        </div>
        <div
          style={{
            fontSize: 28,
            color: "rgba(242,242,242,0.6)",
            maxWidth: 920,
            lineHeight: 1.4,
          }}
        >
          {DESCRIPTION}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            backgroundColor: BRAND_ORANGE,
            display: "flex",
          }}
        />
        <span style={{ fontSize: 22, color: "rgba(242,242,242,0.5)" }}>
          miravelt.lokeshrc.me
        </span>
      </div>
    </div>
  );
}
