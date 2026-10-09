// Central place for brand copy and contact details.
// TODO(client): replace every placeholder below with real, verified details.

const R2 = "https://pub-ab61e9141ab444a2a62d1178bcf81b10.r2.dev";

export const site = {
  name: "C-ZUCHI",
  legalName: "C-ZUCHI Global Service Ltd",
  // TODO(client): CAC registration number, shown on invoices when set.
  rcNumber: "8902736",
  tagline: "Your Trusted Shipping Container Plug.",
  description: "Buy verified 20ft and 40ft shipping containers in Nigeria — new and used, inspected before sale, with nationwide delivery from our Lagos and Port Harcourt terminals.",
  seoTitle: "Shipping Containers for Sale in Nigeria — 20ft & 40ft, New & Used",
  keywords: [
    "shipping containers for sale in Nigeria",
    "buy container Lagos",
    "20ft container price Nigeria",
    "40ft high cube container",
    "used shipping containers Lagos",
    "container delivery Nigeria",
    "Apapa container terminal",
    "Port Harcourt shipping container",
    "C-ZUCHI",
  ],
  phone: "+234 803 339 1757",
  whatsapp: "https://wa.me/2348033391757",
  email: "sales@c-zuchigrp.com",
  address: "Apapa, Lagos, Nigeria",
  hours: "Mon – Sat · 8:00 – 18:00 WAT",
  socials: {
    x: "https://x.com",
    instagram: "https://instagram.com",
    facebook: "https://facebook.com",
    tiktok: "https://tiktok.com",
  },
};

export const nav = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Containers" },
  { href: "/haulage", label: "Truck hire" },
  { href: "/gallery", label: "Gallery" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/contact", label: "Contact" },
];

export const heroSlides = [
  {
    image: `${R2}/containers/1790521534103/1790521535495-weot3eas.jpg`,
    eyebrow: "Brand new · One-trip",
    title: "Containers that arrive ready to work.",
    body: "Verified 20ft & 40ft units across our Lagos and Port Harcourt terminals.",
  },
  {
    image: `${R2}/containers/1/1790520921775-ndt81c3g.jpg`,
    eyebrow: "Inspect before you buy",
    title: "See it in person. Then decide.",
    body: "Book a terminal inspection in under a minute — no obligation.",
  },
  {
    image: `${R2}/containers/7/1790521227127-22f0h193.jpg`,
    eyebrow: "Nationwide delivery",
    title: "From our yard to your site.",
    body: "Flatbed delivery to all 36 states, with transparent upfront pricing.",
  },
];

export const steps = [
  { title: "Browse", body: "Filter verified containers by size, condition and terminal." },
  { title: "Inspect or buy", body: "Book a free terminal inspection, or check out securely online." },
  { title: "Choose delivery", body: "Pick up at the terminal or have it delivered to your site." },
  { title: "Receive", body: "Your container arrives inspected, documented and ready to use." },
];

export const stats = [
  { value: 1200, suffix: "+", label: "Containers delivered" },
  { value: 36, suffix: "", label: "States covered" },
  { value: 3, suffix: "", label: "Terminals" },
  { value: 98, suffix: "%", label: "On-time delivery" },
];

// TODO(client): PLACEHOLDER testimonials — replace with real, consented customer quotes before launch.
export const testimonials = [
  { quote: "Browse verified containers across our terminals, book a viewing, or order with delivery.", name: "Onuoha S.C", role: "C.E.O, C-ZUCHI" },
  { quote: "Placeholder — replace with a real customer testimonial.", name: "Customer name", role: "Company · City" },
  { quote: "Placeholder — replace with a real customer testimonial.", name: "Customer name", role: "Company · City" },
];

export const gallery = [
  { type: "image" as const, src: `${R2}/gallery/image/1790522194118-n525vrdf.jpg`, caption: "One of our deliveries this week." },
  { type: "video" as const, src: `${R2}/gallery/video/1790521985812-udsdru71.mp4`, caption: "Offloading at a customer site." },
  { type: "image" as const, src: `${R2}/containers/1790521534103/1790521535495-weot3eas.jpg`, caption: "40ft High Cube — Apapa terminal." },
  { type: "image" as const, src: `${R2}/containers/1790521537719/1790521539737-rcdaiup0.jpg`, caption: "Interior inspection." },
  { type: "image" as const, src: `${R2}/containers/1/1790520926467-zfcxv6xz.jpg`, caption: "20ft standard, ready for pickup." },
  { type: "image" as const, src: `${R2}/containers/7/1790521233397-h6fqzfnf.jpg`, caption: "Door & seal check." },
  { type: "image" as const, src: `${R2}/containers/1790521541439/1790521542431-rs1gkat1.jpg`, caption: "Stacked inventory." },
  { type: "image" as const, src: `${R2}/containers/7/1790521318256-2psctiun.jpg`, caption: "Yard overview." },
];
