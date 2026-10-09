// Buying landing pages for search intent ("20ft container price in Nigeria",
// "containers for sale in Abuja", ...). Each page shows LIVE listings and
// prices; city pages also show a delivery estimate from the pricing engine,
// so every page carries data of its own rather than templated text.

export interface LandingPage {
  slug: string;
  title: string; // <title>; "{month}" is replaced with the current month + year
  h1: string;
  description: string;
  intro: string;
  filter: { sizes?: string[]; conditions?: string[] };
  /** City pages: where to estimate delivery to. */
  city?: { name: string; lat: number; lng: number };
  points: string[];
  faqs: { q: string; a: string }[];
  guides: string[]; // guide slugs to link
  group: "size" | "condition" | "city";
}

const SIZE_GUIDES = ["shipping-container-sizes-and-dimensions", "20ft-vs-40ft-container", "how-to-buy-a-shipping-container-in-nigeria"];
const CITY_GUIDES = ["how-to-buy-a-shipping-container-in-nigeria", "20ft-vs-40ft-container", "how-to-inspect-a-used-shipping-container"];

const cityFaqs = (city: string) => [
  { q: `Do you deliver shipping containers to ${city}?`, a: `Yes. Choose "Deliver to my site" at checkout and drop a pin on your exact location in ${city} — the delivery fee is calculated from the road distance and shown before you pay.` },
  { q: `Can I inspect a container before buying for delivery to ${city}?`, a: "Yes. Book a free inspection at our terminal, or ask our team on WhatsApp for a walk-around video of the exact unit." },
  { q: "How do I pay?", a: "Online by card, bank transfer or USSD through Paystack. You get an emailed receipt, and an invoice with the container number after delivery." },
];

function city(slug: string, name: string, lat: number, lng: number, intro: string, points: string[]): LandingPage {
  return {
    slug,
    group: "city",
    title: `Shipping Containers for Sale in ${name} — 20ft & 40ft, Delivered`,
    h1: `Shipping containers for sale in ${name}`,
    description: `New and used 20ft & 40ft shipping containers delivered to ${name}. Live prices, free inspection, secure payment and delivery priced to your location.`,
    intro,
    filter: {},
    city: { name, lat, lng },
    points,
    faqs: cityFaqs(name),
    guides: CITY_GUIDES,
  };
}

export const landingPages: LandingPage[] = [
  {
    slug: "20ft-container-price-in-nigeria",
    group: "size",
    title: "20ft Container Price in Nigeria ({month}) — New & Used for Sale",
    h1: "20ft shipping container prices in Nigeria",
    description: "Current prices for new and used 20ft shipping containers in Nigeria, from verified listings. Inspect for free, pay securely and get nationwide delivery.",
    intro: "The 20ft container is the most popular size in Nigeria — big enough for a shop, office or store, small enough to deliver into most compounds. Prices below come straight from our current listings and update as stock changes.",
    filter: { sizes: ["20FT"] },
    points: ["About 14 m² of floor and 33 m³ of space", "Fits most estates and compounds", "Popular for shops, kiosks, site offices and storage"],
    faqs: [
      { q: "How much is a 20ft container in Nigeria?", a: "See the live price range at the top of this page — it is calculated from the 20ft containers we currently have for sale, and depends on condition (new / one-trip, used or refurbished)." },
      { q: "What are the dimensions of a 20ft container?", a: "Externally about 6.06 m × 2.44 m × 2.59 m; inside about 5.9 m long, 2.35 m wide and 2.39 m high." },
      { q: "Does the price include delivery?", a: "No — delivery is added at checkout based on the distance to your location, and shown before you pay. Pickup from our terminal is free." },
    ],
    guides: SIZE_GUIDES,
  },
  {
    slug: "40ft-container-price-in-nigeria",
    group: "size",
    title: "40ft Container Price in Nigeria ({month}) — Standard & High Cube",
    h1: "40ft shipping container prices in Nigeria",
    description: "Current prices for new and used 40ft and 40ft High Cube shipping containers in Nigeria, from verified listings. Free inspection and nationwide delivery.",
    intro: "A 40ft container doubles the floor space of a 20ft and usually costs less per square metre — the go-to for warehousing and larger conversions. The prices below are live from our current 40ft and 40ft High Cube listings.",
    filter: { sizes: ["40FT", "40HC"] },
    points: ["About 28 m² of floor and 67 m³ of space (76 m³ High Cube)", "Best value per square metre", "Needs a long, clear approach for delivery"],
    faqs: [
      { q: "How much is a 40ft container in Nigeria?", a: "The live price range at the top of this page comes from the 40ft containers we currently have for sale. Price depends on condition and whether it is a standard or High Cube unit." },
      { q: "What is the difference between a 40ft and a 40ft High Cube?", a: "Same length and width; the High Cube is about 30 cm taller (9′6″ vs 8′6″), which matters for conversions and bulky cargo." },
      { q: "Can a 40ft container be delivered to my site?", a: "Usually, if the truck has a clear approach. Check gate width, turning space and overhead cables before delivery." },
    ],
    guides: SIZE_GUIDES,
  },
  {
    slug: "high-cube-containers-for-sale",
    group: "size",
    title: "High Cube Containers for Sale in Nigeria — 40ft & 45ft HC",
    h1: "High Cube shipping containers for sale",
    description: "Buy 40ft and 45ft High Cube shipping containers in Nigeria — the extra headroom for offices, homes and bulky storage. Live prices and nationwide delivery.",
    intro: "High Cube containers are one foot taller than standard units, which makes them the first choice for container offices, homes and anything that needs a ceiling, insulation or tall racking.",
    filter: { sizes: ["40HC", "45HC"] },
    points: ["About 2.69 m internal height", "Ideal for conversions and tall storage", "Same footprint as a standard 40ft"],
    faqs: [
      { q: "How tall is a High Cube container?", a: "About 2.90 m (9′6″) on the outside and roughly 2.69 m inside." },
      { q: "Is a High Cube worth it for an office?", a: "Usually yes — once you add insulation and a ceiling, a standard container can feel low; a High Cube keeps comfortable headroom." },
    ],
    guides: ["shipping-container-sizes-and-dimensions", "shipping-container-uses"],
  },
  {
    slug: "new-shipping-containers-for-sale",
    group: "condition",
    title: "New (One-Trip) Shipping Containers for Sale in Nigeria",
    h1: "New shipping containers for sale",
    description: "Buy new one-trip 20ft and 40ft shipping containers in Nigeria — straight walls, clean floors and good seals. Live prices, free inspection, nationwide delivery.",
    intro: "New containers are one-trip units: used once to carry cargo, then sold. They're the best choice for shops, offices and homes where appearance and a perfect seal matter.",
    filter: { conditions: ["NEW"] },
    points: ["One-trip: like-new condition", "Straight walls, clean floor, tight seals", "Best for shops, offices and conversions"],
    faqs: [
      { q: "What does one-trip container mean?", a: "A container that has made a single voyage with cargo after manufacture, then been sold — effectively new." },
      { q: "Are new containers worth the extra cost?", a: "For conversions and customer-facing uses, usually yes. For plain storage, a good used container is often better value." },
    ],
    guides: ["new-vs-used-shipping-containers", "shipping-container-uses"],
  },
  {
    slug: "used-shipping-containers-for-sale",
    group: "condition",
    title: "Used Shipping Containers for Sale in Nigeria — Inspected 20ft & 40ft",
    h1: "Used shipping containers for sale",
    description: "Affordable used and refurbished 20ft and 40ft shipping containers in Nigeria, inspected before sale. Live prices, free inspection and nationwide delivery.",
    intro: "Used containers are the most affordable way to get secure, weatherproof storage. Every unit we list is checked for structure, doors, seals and floor — and you can inspect it yourself for free before you pay.",
    filter: { conditions: ["USED", "REFURBISHED"] },
    points: ["Best value for storage", "Wind & watertight units inspected before listing", "Free inspection before you pay"],
    faqs: [
      { q: "Are used shipping containers good for storage?", a: "Yes — a wind & watertight used container is secure, weatherproof and the most economical storage option." },
      { q: "What should I check on a used container?", a: "Rust on structural parts, roof dents, the floor, door seals and the light test. See our inspection checklist." },
    ],
    guides: ["how-to-inspect-a-used-shipping-container", "new-vs-used-shipping-containers"],
  },
  city("shipping-containers-for-sale-in-lagos", "Lagos", 6.5244, 3.3792,
    "Our Lagos stock sits at the Apapa and Tin Can Island terminals, so delivery within Lagos is the quickest and cheapest we offer — from Lekki and Ajah to Ikeja, Ikorodu and Badagry.",
    ["Same-city delivery from Apapa / Tin Can", "Delivery priced to your exact pin", "Pick up free from the terminal"]),
  city("shipping-containers-for-sale-in-abuja", "Abuja", 9.0765, 7.3986,
    "Building, storing or setting up shop in the FCT? We deliver containers from Lagos to Abuja and the surrounding areas — Gwarinpa, Kubwa, Lugbe, Karu and beyond — with the fee worked out from the actual road distance.",
    ["Delivered from Lagos to the FCT", "Fee shown before you pay", "Popular for site offices and storage"]),
  city("shipping-containers-for-sale-in-port-harcourt", "Port Harcourt", 4.8156, 7.0498,
    "Containers for Port Harcourt, Onne, Eleme and the wider Rivers State — for oil & gas yards, construction sites, shops and storage.",
    ["Delivery across Rivers State", "Units suited to site offices and yards", "Secure online payment"]),
  city("shipping-containers-for-sale-in-ibadan", "Ibadan", 7.3775, 3.947,
    "Ibadan is a short haul from our Lagos terminals, which keeps delivery affordable — ideal for traders, warehouses and farms across Oyo State.",
    ["Short haul from Lagos", "Popular for warehouses and farm storage", "Pin-accurate delivery pricing"]),
  city("shipping-containers-for-sale-in-kano", "Kano", 12.0022, 8.592,
    "Secure, weatherproof storage for traders and agribusinesses in Kano and across the North — delivered by road with the fee calculated before you pay.",
    ["Long-distance delivery from Lagos", "Ideal for grain and goods storage", "Fee calculated to your location"]),
  city("shipping-containers-for-sale-in-benin-city", "Benin City", 6.335, 5.6037,
    "Shops, stores and site offices for Benin City and Edo State, delivered from our Lagos terminals.",
    ["Delivered across Edo State", "New and used units", "Free terminal inspection"]),
  city("shipping-containers-for-sale-in-enugu", "Enugu", 6.4584, 7.5464,
    "Containers delivered to Enugu and the South-East — for shops, offices, storage and building sites.",
    ["Delivered across the South-East", "Shop, office and storage units", "Secure Paystack payment"]),
  city("shipping-containers-for-sale-in-warri", "Warri", 5.5167, 5.75,
    "Containers for Warri, Effurun and Delta State — site cabins, stores and secure storage, delivered to your pin.",
    ["Delivered across Delta State", "Site cabins and storage", "Delivery priced before you pay"]),
];

export const landingBySlug = (slug: string) => landingPages.find((p) => p.slug === slug);
