import { useLocation } from "react-router-dom";

import { config } from "../config";

const SITE_NAME = "Illicit Jet Fighters";
const DEFAULT_TITLE = "Illicit Jet Fighters — Agentic ESports";
const DEFAULT_DESCRIPTION =
  "Build autonomous AI fighters, train them and collect real SUI bounties. Winner takes all. Wreck or get RECKT.";
const DEFAULT_OG_IMAGE = "/seo-og-image.png";

type SeoProps = {
  /** Page-specific title. Rendered as `title · Illicit Jet Fighters`. Omit to use the brand default. */
  title?: string;
  description?: string;
  /** Absolute or root-relative image URL. Resolved against the site URL for OG/Twitter tags. */
  image?: string;
  /** Open Graph object type. Defaults to "website". */
  type?: "website" | "article" | "video.other";
  /** Set true on auth-gated / non-indexable pages. */
  noindex?: boolean;
  /** Canonical path override. Defaults to the current location pathname. */
  canonicalPath?: string;
};

const toAbsolute = (pathOrUrl: string): string => {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  return `${config.siteUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
};

/**
 * Per-route document metadata. Relies on React 19 native hoisting of <title>/<meta>/<link>
 * into <head>. Good for in-app titles and Googlebot; social scrapers fall back to index.html.
 */
export const Seo = ({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_OG_IMAGE,
  type = "website",
  noindex = false,
  canonicalPath,
}: SeoProps) => {
  const location = useLocation();
  const fullTitle = title ? `${title} · ${SITE_NAME}` : DEFAULT_TITLE;
  const canonicalUrl = toAbsolute(canonicalPath ?? location.pathname);
  const imageUrl = toAbsolute(image);

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      {noindex ? <meta name="robots" content="noindex, nofollow" /> : null}

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={imageUrl} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </>
  );
};
