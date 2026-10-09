// Buyer guides (SEO content). Facts here are general industry information —
// dimensions are typical ISO values and vary slightly by manufacturer. Prices
// are NEVER hard-coded: pages show live figures from the current listings.
//
// Inline markup: [text](/path) for links, **bold**.

export type Block = string | { list: string[] } | { table: { head: string[]; rows: string[][] } } | { note: string };

export interface Guide {
  slug: string;
  title: string; // <title> and card title
  h1: string;
  description: string; // meta description
  updated: string; // ISO date the content was last reviewed
  readMins: number;
  /** Show live prices for these sizes (container `size` values). */
  livePrices?: string[];
  sections: { h2: string; body: Block[] }[];
  faqs: { q: string; a: string }[];
  related: { href: string; label: string }[];
}

export const guides: Guide[] = [
  {
    slug: "how-to-buy-a-shipping-container-in-nigeria",
    title: "How to Buy a Shipping Container in Nigeria — Step-by-Step Guide",
    h1: "How to buy a shipping container in Nigeria",
    description:
      "A practical step-by-step guide to buying a shipping container in Nigeria: choosing the size and condition, inspecting, paying safely, and getting it delivered to your site.",
    updated: "2026-10-09",
    readMins: 6,
    livePrices: ["20FT", "40FT", "40HC"],
    sections: [
      {
        h2: "1. Decide what the container is for",
        body: [
          "Start with the job, not the box. A container bought for **storage** has different needs from one that will become a **shop, office or site cabin**, or one that will be **exported** with cargo.",
          {
            list: [
              "**Storage / warehouse** — wind & watertight used units are usually the best value.",
              "**Shop, office, kiosk or living space** — choose a newer unit with straight walls and a good floor; a High Cube gives extra headroom for ceilings and lighting.",
              "**Shipping cargo** — the container must be cargo-worthy with a valid CSC plate.",
            ],
          },
        ],
      },
      {
        h2: "2. Choose the size",
        body: [
          "Most buyers choose between a **20ft** and a **40ft** container. A 20ft is easier to deliver into tight compounds and estates; a 40ft gives double the floor space for not much more than double the price, and a **40ft High Cube** adds about 30 cm of height. See [20ft vs 40ft](/guides/20ft-vs-40ft-container) and the full [sizes & dimensions](/guides/shipping-container-sizes-and-dimensions) guide.",
        ],
      },
      {
        h2: "3. New or used?",
        body: [
          "\"New\" containers are usually **one-trip** units — manufactured, used once to carry cargo, then sold. Used containers have years of service and vary more in condition. Read [new vs used containers](/guides/new-vs-used-shipping-containers) for how to choose.",
        ],
      },
      {
        h2: "4. Inspect before you pay",
        body: [
          "Photos can hide rust, dents and soft floors. Either inspect in person or ask the seller for a detailed walk-around video. Our [inspection checklist](/guides/how-to-inspect-a-used-shipping-container) lists exactly what to check. On C-ZUCHI you can [book a free terminal inspection](/inspection) for any listed unit.",
        ],
      },
      {
        h2: "5. Pay safely",
        body: [
          "Avoid paying large sums into personal accounts for a container you haven't seen. Pay a registered business, get a receipt, and prefer payment methods with a record. On this site, payment is processed by **Paystack** (card, bank transfer or USSD) and you receive an emailed receipt and invoice with the container number.",
        ],
      },
      {
        h2: "6. Plan the delivery",
        body: [
          "Containers are delivered on a flatbed or side-loader truck. Before delivery day:",
          {
            list: [
              "Make sure the truck can reach the spot — check gate width, overhead cables, trees and soft ground.",
              "Prepare a **firm, level base** (concrete blocks or a slab at each corner) so the doors open and close properly.",
              "Leave clearance in front of the doors.",
              "Check any estate or local authority rules for placing a container on your property.",
            ],
          },
          "Delivery is priced by distance from our yard to your location — drop a pin at checkout to see the exact fee. Already have a container somewhere else? [Book a truck to move it](/haulage).",
        ],
      },
    ],
    faqs: [
      { q: "How much does a shipping container cost in Nigeria?", a: "Prices depend on size, condition and market rates. The prices shown on this page are live from current listings; browse all containers for up-to-date prices." },
      { q: "Can I buy a container online?", a: "Yes. On C-ZUCHI you can add a container to your cart, choose pickup or delivery, and pay securely with Paystack. You can also book a free inspection first." },
      { q: "Do you deliver outside Lagos?", a: "Yes, we deliver nationwide. The delivery fee is worked out from the road distance between our yard and your location and shown before you pay." },
    ],
    related: [
      { href: "/shipping-containers/20ft-container-price-in-nigeria", label: "20ft container prices" },
      { href: "/shipping-containers/40ft-container-price-in-nigeria", label: "40ft container prices" },
      { href: "/browse", label: "Browse all containers" },
    ],
  },
  {
    slug: "shipping-container-sizes-and-dimensions",
    title: "Shipping Container Sizes & Dimensions (20ft, 40ft, High Cube) — Guide",
    h1: "Shipping container sizes and dimensions",
    description:
      "Internal and external dimensions, door size, volume and weight of 20ft, 40ft, 40ft High Cube and 45ft shipping containers — in metres and feet.",
    updated: "2026-10-09",
    readMins: 4,
    livePrices: ["20FT", "40FT", "40HC", "45HC"],
    sections: [
      {
        h2: "Standard container dimensions at a glance",
        body: [
          "The figures below are typical for ISO dry (general-purpose) containers. Exact numbers vary slightly between manufacturers, so always confirm on the unit's data plate.",
          {
            table: {
              head: ["", "20ft", "40ft", "40ft High Cube", "45ft High Cube"],
              rows: [
                ["External length", "6.06 m (20′)", "12.19 m (40′)", "12.19 m (40′)", "13.72 m (45′)"],
                ["External width", "2.44 m (8′)", "2.44 m (8′)", "2.44 m (8′)", "2.44 m (8′)"],
                ["External height", "2.59 m (8′6″)", "2.59 m (8′6″)", "2.90 m (9′6″)", "2.90 m (9′6″)"],
                ["Internal length", "≈ 5.90 m", "≈ 12.03 m", "≈ 12.03 m", "≈ 13.56 m"],
                ["Internal width", "≈ 2.35 m", "≈ 2.35 m", "≈ 2.35 m", "≈ 2.35 m"],
                ["Internal height", "≈ 2.39 m", "≈ 2.39 m", "≈ 2.69 m", "≈ 2.69 m"],
                ["Floor area", "≈ 13.9 m²", "≈ 28.3 m²", "≈ 28.3 m²", "≈ 31.9 m²"],
                ["Volume", "≈ 33 m³", "≈ 67 m³", "≈ 76 m³", "≈ 86 m³"],
                ["Empty (tare) weight", "≈ 2,200 kg", "≈ 3,750 kg", "≈ 3,900 kg", "≈ 4,800 kg"],
              ],
            },
          },
          { note: "Door opening is roughly 2.34 m wide × 2.28 m high on standard units and about 2.58 m high on High Cubes." },
        ],
      },
      {
        h2: "Which size fits your space?",
        body: [
          {
            list: [
              "**20ft** — about the size of a single parking space plus a bit. Easiest to deliver into estates and narrow streets. Popular for shops, storage and site offices.",
              "**40ft** — double the floor area. Better value per square metre for warehouses and large stores, but needs more room for the truck to manoeuvre.",
              "**40ft High Cube** — same footprint as a 40ft with roughly 30 cm more headroom. Preferred for conversions (offices, apartments) where you'll add insulation and a ceiling.",
              "**45ft High Cube** — the largest common size; mostly used for bulky, light cargo.",
            ],
          },
          "Remember to allow space around the container: the doors swing outwards, and the delivery truck needs a clear approach. Compare the two most common sizes in [20ft vs 40ft](/guides/20ft-vs-40ft-container).",
        ],
      },
    ],
    faqs: [
      { q: "How big is a 20ft container inside?", a: "Roughly 5.9 m long, 2.35 m wide and 2.39 m high inside — about 13.9 m² of floor and 33 m³ of space." },
      { q: "How big is a 40ft container?", a: "Externally 12.19 m long, 2.44 m wide and 2.59 m high (2.90 m for a High Cube). Inside it is about 12 m long with around 28 m² of floor." },
      { q: "What is a High Cube container?", a: "A High Cube is one foot (about 30 cm) taller than a standard container — 9′6″ instead of 8′6″ externally — giving more headroom and volume." },
    ],
    related: [
      { href: "/shipping-containers/20ft-container-price-in-nigeria", label: "20ft containers for sale" },
      { href: "/shipping-containers/40ft-container-price-in-nigeria", label: "40ft containers for sale" },
      { href: "/shipping-containers/high-cube-containers-for-sale", label: "High Cube containers" },
    ],
  },
  {
    slug: "20ft-vs-40ft-container",
    title: "20ft vs 40ft Container: Which Should You Buy? (Nigeria)",
    h1: "20ft vs 40ft container: which should you buy?",
    description:
      "Comparing 20ft and 40ft shipping containers for storage, shops, offices and shipping in Nigeria — space, price, delivery access and resale.",
    updated: "2026-10-09",
    readMins: 4,
    livePrices: ["20FT", "40FT", "40HC"],
    sections: [
      {
        h2: "The short answer",
        body: [
          "Choose a **20ft** if space or access is tight, you need a single shop or office, or you're on a smaller budget. Choose a **40ft** (or 40ft High Cube) if you need maximum storage or floor space — it usually costs less per square metre.",
        ],
      },
      {
        h2: "Side by side",
        body: [
          {
            table: {
              head: ["", "20ft", "40ft"],
              rows: [
                ["Floor area", "≈ 14 m²", "≈ 28 m²"],
                ["Volume", "≈ 33 m³", "≈ 67 m³ (76 m³ High Cube)"],
                ["Delivery access", "Fits most compounds and estates", "Needs a long, clear approach"],
                ["Best for", "Shops, kiosks, site offices, small storage", "Warehousing, large stores, multi-room conversions"],
                ["Cost per m²", "Higher", "Lower"],
              ],
            },
          },
        ],
      },
      {
        h2: "Things people forget",
        body: [
          {
            list: [
              "**Delivery is the deciding factor more often than budget.** Measure your gate and the route to the spot before choosing a 40ft.",
              "**Two 20ft units are more flexible than one 40ft** — you can place them separately or side by side — but cost more in total.",
              "**For conversions, height matters.** A standard 8′6″ container loses headroom quickly once you add insulation and a ceiling; a High Cube avoids that.",
            ],
          },
        ],
      },
    ],
    faqs: [
      { q: "Is a 40ft container twice the price of a 20ft?", a: "Usually less than twice. Compare the live prices shown on this page — a 40ft generally gives more space per naira." },
      { q: "Can a 20ft container be delivered in Lagos estates?", a: "In most cases yes, provided the truck can reach the spot. Check gate width, overhead cables and the ground before delivery day." },
    ],
    related: [
      { href: "/guides/shipping-container-sizes-and-dimensions", label: "Full sizes & dimensions" },
      { href: "/shipping-containers/20ft-container-price-in-nigeria", label: "Shop 20ft containers" },
      { href: "/shipping-containers/40ft-container-price-in-nigeria", label: "Shop 40ft containers" },
    ],
  },
  {
    slug: "new-vs-used-shipping-containers",
    title: "New vs Used Shipping Containers: Which Is Right for You?",
    h1: "New vs used shipping containers",
    description:
      "What \"new\" (one-trip) and used shipping containers really mean, how condition grades work, and which to choose for storage, conversion or export.",
    updated: "2026-10-09",
    readMins: 4,
    sections: [
      {
        h2: "What \"new\" actually means",
        body: [
          "Almost all \"new\" containers are **one-trip** units: built at the factory, loaded once with cargo for the voyage, then sold. They have straight walls, fresh paint, clean floors and good door seals.",
        ],
      },
      {
        h2: "Used container condition grades",
        body: [
          "Sellers describe used containers in a few common ways:",
          {
            list: [
              "**Cargo-worthy (CW)** — structurally sound enough to ship cargo, normally with a valid CSC safety plate.",
              "**Wind & watertight (WWT)** — no holes, keeps out rain and wind; fine for storage but may not be certified to ship.",
              "**As-is** — sold with known damage; only worth it if the price reflects the repairs.",
              "**Refurbished** — a used unit repaired and repainted; check what was actually fixed.",
            ],
          },
        ],
      },
      {
        h2: "Which should you buy?",
        body: [
          {
            table: {
              head: ["Use", "Our suggestion"],
              rows: [
                ["Storage (goods, equipment, farm)", "Used — wind & watertight"],
                ["Shop, kiosk, office, apartment", "New / one-trip or refurbished"],
                ["Shipping cargo abroad", "Cargo-worthy with a valid CSC plate"],
                ["Tight budget, any use", "Used, inspected in person"],
              ],
            },
          },
          "Whatever you choose, inspect it first — see the [inspection checklist](/guides/how-to-inspect-a-used-shipping-container).",
        ],
      },
    ],
    faqs: [
      { q: "Are used containers safe to buy?", a: "Yes, if inspected. Check the floor, roof, doors and seals and look for structural rust. A good used container will last many years as storage." },
      { q: "How long does a shipping container last?", a: "With basic maintenance — keeping the roof clear of standing water and treating rust spots — a container can last decades on land." },
    ],
    related: [
      { href: "/shipping-containers/new-shipping-containers-for-sale", label: "New containers for sale" },
      { href: "/shipping-containers/used-shipping-containers-for-sale", label: "Used containers for sale" },
      { href: "/inspection", label: "Book a free inspection" },
    ],
  },
  {
    slug: "how-to-inspect-a-used-shipping-container",
    title: "How to Inspect a Used Shipping Container Before Buying — Checklist",
    h1: "How to inspect a used shipping container (checklist)",
    description:
      "A practical checklist for inspecting a used shipping container before you buy: rust, roof, floor, doors, seals, the light test, data plate and container number.",
    updated: "2026-10-09",
    readMins: 5,
    sections: [
      {
        h2: "Outside",
        body: [
          {
            list: [
              "**Rust** — surface rust is cosmetic; flaking or holed metal, especially on the corner posts, bottom rails and roof, is structural.",
              "**Roof** — look for dents that hold water. Standing water is the main cause of roof rust.",
              "**Walls** — dents are normal; creases or holes are not.",
              "**Corner castings** — the four lifting points at each corner should be solid and undamaged.",
            ],
          },
        ],
      },
      {
        h2: "Doors and seals",
        body: [
          {
            list: [
              "Both doors should open and close without forcing, and the locking bars should turn freely.",
              "Rubber door gaskets should be soft, complete and not torn — they keep rain out.",
              "Hinges should not be cracked or heavily rusted.",
            ],
          },
        ],
      },
      {
        h2: "Inside",
        body: [
          {
            list: [
              "**The light test** — step inside, close the doors, and look for daylight through the roof or walls. Any light means a hole.",
              "**Floor** — usually marine plywood. Walk the whole floor and feel for soft or spongy spots, delamination or holes.",
              "**Smell** — a strong chemical smell can mean a past spill; important if you'll store food or convert it into a living space.",
              "**Water marks** — stains on walls or floor point to a leak.",
            ],
          },
        ],
      },
      {
        h2: "Paperwork and identity",
        body: [
          "Every container has a unique **container number** painted on the doors (four letters and seven digits, e.g. CSQU 305438 3). The last digit is a check digit — a mistyped number won't validate. Match the number on the door to the one on your receipt or invoice. Cargo-worthy units also carry a **CSC plate** showing the last safety examination date.",
          "On C-ZUCHI, your invoice records the container number of the exact unit delivered.",
        ],
      },
    ],
    faqs: [
      { q: "Can I inspect a container before I pay?", a: "Yes — book a free inspection at our terminal for any listed container." },
      { q: "Is surface rust a problem?", a: "Usually not. Light surface rust can be wire-brushed and painted. Worry about flaking rust or holes in structural parts like corner posts, rails and the roof." },
    ],
    related: [
      { href: "/inspection", label: "Book a free inspection" },
      { href: "/guides/new-vs-used-shipping-containers", label: "New vs used containers" },
      { href: "/shipping-containers/used-shipping-containers-for-sale", label: "Used containers for sale" },
    ],
  },
  {
    slug: "shipping-container-uses",
    title: "What Can You Use a Shipping Container For? Shops, Offices, Storage & More",
    h1: "What can you use a shipping container for?",
    description:
      "Popular uses for shipping containers in Nigeria — storage, shops, offices, site cabins, farms and homes — and which size and condition suit each.",
    updated: "2026-10-09",
    readMins: 4,
    sections: [
      {
        h2: "Popular uses",
        body: [
          {
            list: [
              "**Secure storage** — goods, stock, equipment, tools and farm produce. Lockable, weatherproof and movable.",
              "**Shops and kiosks** — a fast, durable storefront; add a roll-up shutter or glass front.",
              "**Offices and site cabins** — for construction sites, depots and events; insulate and add windows and AC.",
              "**Homes and studios** — single-unit or combined; a High Cube gives the headroom you'll want.",
              "**Farms** — feed and fertiliser stores, cold rooms (with refrigerated units), poultry pens.",
            ],
          },
        ],
      },
      {
        h2: "Tips for a container that will be lived or worked in",
        body: [
          {
            list: [
              "**Heat** — steel gets hot in the Nigerian sun. Plan insulation, roof shading and ventilation from the start.",
              "**Openings** — cutting windows and doors weakens the walls; have a fabricator add steel framing around openings.",
              "**Base** — raise it on blocks or a slab so the floor stays dry and the doors stay square.",
            ],
          },
        ],
      },
    ],
    faqs: [
      { q: "Which container is best for a shop?", a: "A 20ft new or refurbished unit is the most common choice — easy to deliver and big enough for a storefront." },
      { q: "Can I convert a container into an office?", a: "Yes. Choose a sound unit (a High Cube if possible), insulate it well, and frame any cut openings." },
    ],
    related: [
      { href: "/guides/20ft-vs-40ft-container", label: "20ft vs 40ft" },
      { href: "/shipping-containers/new-shipping-containers-for-sale", label: "New containers" },
      { href: "/browse", label: "Browse all containers" },
    ],
  },
];

export const guideBySlug = (slug: string) => guides.find((g) => g.slug === slug);
