import { site } from "@/content/site";

/** Absolute site URL (APP_URL), never throwing on a malformed value. */
export function siteUrl(path = "/"): string {
  let base = "http://localhost:3000";
  try {
    base = new URL(process.env.APP_URL ?? base).origin;
  } catch {
    /* keep default */
  }
  return new URL(path, base).toString();
}

/** Renders schema.org JSON-LD safely (escapes `<` so content can't break out of the script tag). */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

const isPlaceholderPhone = /000\s?000\s?0000/.test(site.phone);
const phone = isPlaceholderPhone ? {} : { telephone: site.phone };

const sameAs = Object.values(site.socials).filter((u) => !/^https:\/\/(x|instagram|facebook|tiktok)\.com\/?$/.test(u)); // skip placeholder roots

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": siteUrl("/#organization"),
    name: site.name,
    legalName: site.legalName,
    ...(site.rcNumber ? { identifier: { "@type": "PropertyValue", propertyID: "CAC RC Number", value: site.rcNumber } } : {}),
    url: siteUrl("/"),
    logo: siteUrl("/brand/logo-full.png"),
    description: site.description,
    email: site.email,
    ...phone,
    address: { "@type": "PostalAddress", addressLocality: "Lagos", addressCountry: "NG", streetAddress: site.address },
    contactPoint: [{ "@type": "ContactPoint", contactType: "sales", email: site.email, ...phone, areaServed: "NG", availableLanguage: ["en"] }],
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": siteUrl("/#website"),
    url: siteUrl("/"),
    name: site.name,
    publisher: { "@id": siteUrl("/#organization") },
    inLanguage: "en-NG",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${siteUrl("/browse")}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: siteUrl(it.path) })),
  };
}

export function faqLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

