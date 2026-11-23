import fs from "node:fs";
import path from "node:path";
import { CURATED_WALLPAPERS } from "@/data/curated-wallpapers";
import { GTA5_VIRAL_WALLPAPERS } from "@/data/gta5-viral-wallpapers";
import { isDemoMode } from "./env";
import type {
  CategoryInfo,
  DeviceType,
  ResolutionInfo,
  Wallpaper,
  WallpaperCollection,
  WallpaperSourceType,
} from "@/types/wallpaper";

export interface DemoArtSpec {
  id: string;
  slug: string;
  title: string;
  description: string;
  source_type: WallpaperSourceType;
  category_slug: string;
  tags: string[];
  dominant_colors: string[];
  width: number;
  height: number;
  aspect_ratio: string;
  device_types: DeviceType[];
  downloads_count: number;
  views_count: number;
  is_textless: boolean;
  is_oled_dark: boolean;
  attribution_text: string;
  created_at: string;
  motif: "vice" | "cyberpunk" | "oled" | "horizon" | "aurora" | "liquid";
}

/**
 * Generates crisp, deterministic, zero-external-dependency SVG artwork for demo mode
 * and for sharp-powered /api/download transcoding when R2 is not yet connected.
 */
export function buildWallpaperSvgMarkup(opts: {
  title: string;
  colors: string[];
  width: number;
  height: number;
  motif: DemoArtSpec["motif"];
  seedIndex: number;
}): string {
  const { colors, width, height, motif, seedIndex } = opts;
  const c0 = colors[0] ?? "#0B0D12";
  const c1 = colors[1] ?? "#FF2E93";
  const c2 = colors[2] ?? "#00F0FF";
  const c3 = colors[3] ?? "#7C3AED";
  const c4 = colors[4] ?? "#1E293B";

  const cx = Math.round(width * (0.48 + ((seedIndex % 5) - 2) * 0.04));
  const cy = Math.round(height * (motif === "vice" || motif === "horizon" ? 0.54 : 0.48));
  const rMain = Math.round(Math.min(width, height) * 0.32);

  let sceneElements = "";

  if (motif === "vice") {
    const horizonY = Math.round(height * 0.62);
    const sunR = Math.round(Math.min(width, height) * 0.22);
    sceneElements = `
      <rect width="${width}" height="${height}" fill="url(#bgGrad)" />
      <circle cx="${cx}" cy="${horizonY - Math.round(sunR * 0.2)}" r="${sunR}" fill="url(#sunGrad)" opacity="0.95" />
      <g opacity="0.35">
        <rect x="${cx - sunR}" y="${horizonY - Math.round(sunR * 0.15)}" width="${sunR * 2}" height="${Math.max(4, Math.round(height * 0.01))}" fill="${c0}" />
        <rect x="${cx - sunR}" y="${horizonY - Math.round(sunR * 0.02)}" width="${sunR * 2}" height="${Math.max(5, Math.round(height * 0.014))}" fill="${c0}" />
        <rect x="${cx - sunR}" y="${horizonY + Math.round(sunR * 0.12)}" width="${sunR * 2}" height="${Math.max(6, Math.round(height * 0.018))}" fill="${c0}" />
      </g>
      <path d="M0 ${horizonY} L${width} ${horizonY} L${width} ${height} L0 ${height} Z" fill="${c0}" opacity="0.92" />
      <path d="M0 ${horizonY} L${width} ${horizonY}" stroke="${c1}" stroke-width="${Math.max(2, Math.round(height * 0.004))}" opacity="0.9" />
      <ellipse cx="${cx}" cy="${horizonY + Math.round(height * 0.08)}" rx="${Math.round(width * 0.34)}" ry="${Math.round(height * 0.05)}" fill="url(#glow1)" opacity="0.56" />
      <ellipse cx="${Math.round(width * 0.25)}" cy="${horizonY + Math.round(height * 0.16)}" rx="${Math.round(width * 0.22)}" ry="${Math.round(height * 0.03)}" fill="url(#glow2)" opacity="0.5" />
      <polygon points="0,${horizonY} ${Math.round(width * 0.18)},${horizonY - Math.round(height * 0.11)} ${Math.round(width * 0.36)},${horizonY}" fill="${c0}" opacity="0.88" />
      <polygon points="${Math.round(width * 0.64)},${horizonY} ${Math.round(width * 0.84)},${horizonY - Math.round(height * 0.14)} ${width},${horizonY}" fill="${c0}" opacity="0.9" />
    `;
  } else if (motif === "cyberpunk") {
    const baseY = Math.round(height * 0.72);
    const towers: string[] = [];
    const towerCount = 11;
    for (let i = 0; i < towerCount; i++) {
      const tw = Math.round(width / towerCount);
      const tx = i * tw;
      const th = Math.round(height * (0.24 + ((i * 37 + seedIndex * 19) % 38) / 100));
      const accent = i % 2 === 0 ? c2 : c1;
      towers.push(
        `<rect x="${tx + 4}" y="${baseY - th}" width="${tw - 8}" height="${th + Math.round(height * 0.3)}" fill="${c0}" stroke="${accent}" stroke-opacity="0.35" stroke-width="2" />`
      );
      towers.push(
        `<rect x="${tx + Math.round(tw * 0.25)}" y="${baseY - th + 16}" width="${Math.max(4, Math.round(tw * 0.5))}" height="4" fill="${accent}" opacity="0.85" />`
      );
    }
    sceneElements = `
      <rect width="${width}" height="${height}" fill="url(#bgGrad)" />
      <circle cx="${Math.round(width * 0.22)}" cy="${Math.round(height * 0.28)}" r="${rMain}" fill="url(#glow2)" opacity="0.44" />
      <circle cx="${Math.round(width * 0.78)}" cy="${Math.round(height * 0.34)}" r="${Math.round(rMain * 1.1)}" fill="url(#glow1)" opacity="0.48" />
      ${towers.join("\n")}
      <rect x="0" y="${baseY}" width="${width}" height="${height - baseY}" fill="url(#reflectGrad)" opacity="0.72" />
    `;
  } else if (motif === "oled") {
    sceneElements = `
      <rect width="${width}" height="${height}" fill="#000000" />
      <circle cx="${cx}" cy="${cy}" r="${Math.round(rMain * 0.92)}" fill="none" stroke="url(#neonStroke)" stroke-width="${Math.max(4, Math.round(Math.min(width, height) * 0.012))}" />
      <circle cx="${cx}" cy="${cy}" r="${Math.round(rMain * 1.3)}" fill="url(#ringGlow)" opacity="0.5" />
      <circle cx="${cx}" cy="${cy}" r="${Math.round(rMain * 0.54)}" fill="#000000" stroke="${c2}" stroke-width="2" stroke-opacity="0.45" />
      <line x1="${Math.round(width * 0.14)}" y1="${cy}" x2="${Math.round(width * 0.86)}" y2="${cy}" stroke="url(#neonStroke)" stroke-width="2" opacity="0.35" />
    `;
  } else if (motif === "aurora") {
    sceneElements = `
      <rect width="${width}" height="${height}" fill="url(#bgGrad)" />
      <path d="M0 ${Math.round(height * 0.34)} Q ${Math.round(width * 0.3)} ${Math.round(height * 0.12)}, ${Math.round(width * 0.55)} ${Math.round(height * 0.32)} T ${width} ${Math.round(height * 0.22)} L ${width} ${Math.round(height * 0.52)} Q ${Math.round(width * 0.6)} ${Math.round(height * 0.4)}, 0 ${Math.round(height * 0.55)} Z" fill="url(#auroraGlow)" opacity="0.7" />
      <polygon points="0,${height} ${Math.round(width * 0.24)},${Math.round(height * 0.58)} ${Math.round(width * 0.48)},${height}" fill="${c0}" />
      <polygon points="${Math.round(width * 0.32)},${height} ${Math.round(width * 0.62)},${Math.round(height * 0.52)} ${Math.round(width * 0.92)},${height}" fill="${c4}" opacity="0.88" />
      <polygon points="${Math.round(width * 0.68)},${height} ${Math.round(width * 0.88)},${Math.round(height * 0.62)} ${width},${height}" fill="${c0}" />
    `;
  } else if (motif === "liquid") {
    sceneElements = `
      <rect width="${width}" height="${height}" fill="${c0}" />
      <path d="M-40 ${Math.round(height * 0.68)} C ${Math.round(width * 0.25)} ${Math.round(height * 0.18)}, ${Math.round(width * 0.62)} ${Math.round(height * 0.92)}, ${width + 40} ${Math.round(height * 0.34)}" fill="none" stroke="url(#neonStroke)" stroke-width="${Math.max(24, Math.round(Math.min(width, height) * 0.12))}" stroke-linecap="round" opacity="0.4" />
      <path d="M-40 ${Math.round(height * 0.68)} C ${Math.round(width * 0.25)} ${Math.round(height * 0.18)}, ${Math.round(width * 0.62)} ${Math.round(height * 0.92)}, ${width + 40} ${Math.round(height * 0.34)}" fill="none" stroke="#FFFFFF" stroke-width="${Math.max(3, Math.round(Math.min(width, height) * 0.008))}" stroke-linecap="round" opacity="0.55" />
      <circle cx="${Math.round(width * 0.72)}" cy="${Math.round(height * 0.28)}" r="${Math.round(rMain * 0.65)}" fill="url(#glow3)" opacity="0.64" />
    `;
  } else {
    // horizon
    const midY = Math.round(height * 0.58);
    sceneElements = `
      <rect width="${width}" height="${height}" fill="url(#bgGrad)" />
      <ellipse cx="${cx}" cy="${midY}" rx="${Math.round(width * 0.45)}" ry="${Math.round(height * 0.2)}" fill="url(#glow1)" opacity="0.72" />
      <rect x="0" y="${midY}" width="${width}" height="${height - midY}" fill="${c0}" opacity="0.92" />
      <line x1="0" y1="${midY}" x2="${width}" y2="${midY}" stroke="url(#neonStroke)" stroke-width="3" />
      <line x1="${cx}" y1="${midY}" x2="${Math.round(width * 0.12)}" y2="${height}" stroke="${c2}" stroke-opacity="0.35" stroke-width="2" />
      <line x1="${cx}" y1="${midY}" x2="${Math.round(width * 0.88)}" y2="${height}" stroke="${c2}" stroke-opacity="0.35" stroke-width="2" />
      <line x1="${cx}" y1="${midY}" x2="${Math.round(width * 0.36)}" y2="${height}" stroke="${c1}" stroke-opacity="0.3" stroke-width="2" />
      <line x1="${cx}" y1="${midY}" x2="${Math.round(width * 0.64)}" y2="${height}" stroke="${c1}" stroke-opacity="0.3" stroke-width="2" />
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c0}" />
      <stop offset="52%" stop-color="${c3}" stop-opacity="0.72" />
      <stop offset="100%" stop-color="${c0}" />
    </linearGradient>
    <linearGradient id="sunGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${c1}" />
      <stop offset="100%" stop-color="${c2}" />
    </linearGradient>
    <linearGradient id="neonStroke" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${c1}" />
      <stop offset="50%" stop-color="${c2}" />
      <stop offset="100%" stop-color="${c3}" />
    </linearGradient>
    <linearGradient id="reflectGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${c2}" stop-opacity="0.28" />
      <stop offset="100%" stop-color="${c0}" stop-opacity="0.98" />
    </linearGradient>
    ${[c1, c2, c3].map((color, index) => `<radialGradient id="glow${index + 1}">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.85" />
      <stop offset="45%" stop-color="${color}" stop-opacity="0.35" />
      <stop offset="100%" stop-color="${color}" stop-opacity="0" />
    </radialGradient>`).join("")}
    <radialGradient id="ringGlow">
      <stop offset="48%" stop-color="${c1}" stop-opacity="0" />
      <stop offset="71%" stop-color="${c1}" stop-opacity="0.6" />
      <stop offset="100%" stop-color="${c1}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="auroraGlow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${c1}" stop-opacity="0" />
      <stop offset="35%" stop-color="${c2}" stop-opacity="0.85" />
      <stop offset="65%" stop-color="${c3}" stop-opacity="0.4" />
      <stop offset="100%" stop-color="${c3}" stop-opacity="0" />
    </linearGradient>
  </defs>
  ${sceneElements}
</svg>`;
}

export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const CATEGORIES: CategoryInfo[] = [
  {
    slug: "gta-6-vice-city",
    name: "GTA 6 & Vice City Neon",
    headline: "GTA 6 & Vice City Neon 4K Wallpapers",
    description:
      "Textless Vice City twilight boulevards, Leonida coastal sunsets, and high-contrast magenta-cyan gaming backdrops engineered for 4K and OLED monitors.",
    editorialIntro:
      "Inspired by South Florida twilight palettes, retro-modern coastal highways, and electric magenta-to-cyan lighting, our Vice City Neon collection is curated specifically for clean desktop setups. Every wallpaper is inspected for zero distracting watermarks, clean edge framing, and crisp color gradients that avoid banding on 10-bit HDR and OLED panels.",
    accentHex: "#FF2E93",
    keywords: ["gta 6 wallpaper 4k", "vice city neon wallpaper", "leonida sunset background"],
  },
  {
    slug: "cyberpunk",
    name: "Cyberpunk & Sci-Fi",
    headline: "Cyberpunk & Futuristic Skyline 4K Wallpapers",
    description:
      "Rain-slicked megacities, holographic alleys, and atmospheric nocturnal sci-fi scenes tuned for dual-monitor and ultrawide battlestations.",
    editorialIntro:
      "Cyberpunk backdrops shine when shadow detail is preserved without crushing midtones. Each piece in our Cyberpunk archive balances deep charcoal architectural silhouettes with controlled cyan, amber, and magenta highlights so desktop icons and terminal windows stay readable.",
    accentHex: "#00F0FF",
    keywords: ["cyberpunk 4k wallpaper", "neon city night background", "sci-fi desktop wallpaper"],
  },
  {
    slug: "minimalist-oled",
    name: "Minimalist OLED",
    headline: "True Black Minimalist OLED Wallpapers",
    description:
      "True #000000 black backgrounds with luminous geometric accents designed to maximize OLED battery efficiency and infinite contrast.",
    editorialIntro:
      "True OLED displays switch off individual pixels whenever they render pure #000000 black. Our Minimalist OLED category enforces high dark-pixel ratios paired with delicate specular accents, giving AMOLED phones and QD-OLED gaming monitors effortless contrast while reducing static burn-in risk.",
    accentHex: "#A855F7",
    keywords: ["true black oled wallpaper", "amoled minimalist wallpaper", "dark 4k background"],
  },
  {
    slug: "ultrawide",
    name: "Ultrawide 21:9 & 32:9",
    headline: "Native 21:9 & 32:9 Ultrawide Wallpapers",
    description:
      "True panoramic 3440x1440 and 5120x1440 wallpapers framed for curved ultrawide and super-ultrawide monitors without awkward cropping.",
    editorialIntro:
      "Stretching a 16:9 image across a 34-inch or 49-inch monitor ruins composition and softens fine detail. Every entry in our Ultrawide catalog is composed natively for 21:9 or 32:9 canvases, keeping focal points balanced across wide horizontal sightlines.",
    accentHex: "#38BDF8",
    keywords: ["3440x1440 wallpaper", "5120x1440 super ultrawide wallpaper", "21:9 gaming wallpaper"],
  },
  {
    slug: "mobile",
    name: "Mobile Lock Screen",
    headline: "9:16 Mobile Lock Screen & AMOLED Wallpapers",
    description:
      "Vertical 9:16 phone wallpapers with intentional top-third negative space so iOS and Android lock screen clocks remain crystal clear.",
    editorialIntro:
      "Great phone wallpapers respect the operating system chrome. Every mobile-first wallpaper in this section reserves clean breathing room behind the lock screen clock and notification stack while placing vibrant visual weight in the lower two-thirds.",
    accentHex: "#F97316",
    keywords: ["iphone lock screen wallpaper", "amoled phone wallpaper 4k", "vertical 9:16 wallpaper"],
  },
  {
    slug: "abstract",
    name: "Abstract & Liquid Glass",
    headline: "Abstract Dark & Liquid Glass 4K Wallpapers",
    description:
      "Refractive obsidian glass ribbons, volumetric caustics, and architectural gradients crafted for distraction-free creative workspaces.",
    editorialIntro:
      "Designed for developers, designers, and video editors who spend ten hours a day in front of their monitors, our Abstract & Liquid Glass collection uses subtle depth cues and smooth 16-bit-sourced gradients to keep your workspace refined without visual fatigue.",
    accentHex: "#10B981",
    keywords: ["liquid glass wallpaper", "dark abstract 4k wallpaper", "minimal workspace background"],
  },
  {
    slug: "nature-cosmos",
    name: "Nature & Cosmos",
    headline: "Aurora, Night Sky & Landscape 4K Wallpapers",
    description:
      "Community-curated aurora curtains, Milky Way arches, alpine ridgelines and coastal dusk photography in native high resolution.",
    editorialIntro:
      "Every frame in this collection is a real photograph selected from community-featured archives for technical quality: clean gradients without banding, deep star fields, and horizons placed low enough to leave room for docks and widgets. Licensed for reuse with photographer credit on each wallpaper page.",
    accentHex: "#38BDF8",
    keywords: ["aurora wallpaper 4k", "milky way wallpaper", "night landscape wallpaper", "nature desktop background"],
  },
];

export const RESOLUTIONS: ResolutionInfo[] = [
  {
    slug: "4k",
    label: "4K UHD",
    dimensions: "3840 × 2160",
    aspectRatio: "16:9",
    headline: "4K UHD (3840×2160) Wallpapers",
    description:
      "Razor-sharp 16:9 4K UHD wallpapers delivered on demand in WebP, PNG, or high-bitrate JPG with zero login walls.",
    editorialNote:
      "4K UHD packs 8.29 million pixels into a standard 16:9 widescreen frame—four times the detail of 1080p Full HD. Use our Smart Download panel on any detail page to grab the exact 3840×2160 master or downscale cleanly to 2560×1440 QHD.",
    minWidth: 3440,
    minHeight: 1440,
    targetDevice: "desktop",
  },
  {
    slug: "ultrawide",
    label: "Ultrawide 21:9",
    dimensions: "3440 × 1440",
    aspectRatio: "21:9",
    headline: "Ultrawide 21:9 (3440×1440) Wallpapers",
    description:
      "Panoramic 21:9 wallpapers built for 34-inch and 38-inch curved ultrawide displays without vertical cropping.",
    editorialNote:
      "Curved 3440×1440 monitors immerse your peripheral vision, making low-resolution stretches immediately noticeable. Our native 21:9 catalog preserves crisp edge geometry across the full horizontal sweep.",
    minWidth: 3440,
    minHeight: 1440,
    targetDevice: "ultrawide",
  },
  {
    slug: "mobile",
    label: "Mobile 9:16",
    dimensions: "1440 × 3200",
    aspectRatio: "9:16",
    headline: "Mobile 9:16 & AMOLED Phone Wallpapers",
    description:
      "Vertical high-DPI phone wallpapers tailored for iPhone Pro Max, Galaxy S Ultra, and Pixel OLED lock screens.",
    editorialNote:
      "Modern flagship smartphones run 460+ PPI OLED panels with tall 19.5:9 to 20:9 aspect ratios. Our Smart Download panel automatically detects your phone's exact logical × DPR resolution and crops cleanly around the center.",
    minWidth: 1080,
    minHeight: 1920,
    targetDevice: "mobile",
  },
  {
    slug: "dual-monitor",
    label: "Super Ultrawide 32:9",
    dimensions: "5120 × 1440",
    aspectRatio: "32:9",
    headline: "Dual Monitor & 32:9 (5120×1440) Wallpapers",
    description:
      "Seamless 5120×1440 super-ultrawide and dual-1440p panoramic backdrops for expansive multi-display setups.",
    editorialNote:
      "Spanning a single cohesive canvas across dual 27-inch monitors or a 49-inch 32:9 Odyssey OLED eliminates mismatched bezels and creates an uninterrupted horizon line.",
    minWidth: 3840,
    minHeight: 1440,
    targetDevice: "ultrawide",
  },
  {
    slug: "oled",
    label: "True Black OLED",
    dimensions: "All OLED Sizes",
    aspectRatio: "Multi",
    headline: "True Black OLED & AMOLED Wallpapers",
    description:
      "High-contrast dark wallpapers verified for deep shadow luminance to showcase infinite OLED contrast ratios.",
    editorialNote:
      "Every wallpaper in this filter passes our luminance threshold check for deep dark pixel coverage—ideal for late-night coding, HDR gaming, and mobile battery conservation.",
    minWidth: 1080,
    minHeight: 1080,
  },
];

export const COLLECTIONS: WallpaperCollection[] = [
  {
    slug: "vice-city-midnight-pack",
    title: "Vice City Midnight Pack",
    subtitle: "Coastal neon, humid palms, and retro-modern highway twilight",
    curator: "Trendy-Wallpapers Curatorial Desk",
    updatedAt: "2026-11-10",
    accentHex: "#FF2E93",
    commentary: [
      "Few visual palettes in gaming history command instant recognition like the humid twilight of Vice City. Rather than leaning on loud, oversaturated 1980s clichés that clash with modern operating system UI, this pack distills the aesthetic into deep obsidian shadows, electric magenta horizons, and crisp cyan reflections across rain-slicked asphalt.",
      "Every piece in the Vice City Midnight Pack was selected for balanced contrast under real-world desktop conditions. When you place translucent macOS windows, Windows 11 Acrylic panels, or a dark-mode code editor over these frames, the upper sky maintains calm low-frequency gradients while the horizon delivers an unmistakable neon pulse.",
      "We also ensured multi-device cohesion across the pack: you can pair a 3840×2160 boulevard sunset on your primary 4K display with a matching 3440×1440 coastal bridge panorama on an ultrawide wing monitor, and carry the exact same color story onto your phone with a 9:16 lock screen edition featuring dedicated top-third clock negative space.",
      "To get the cleanest visual result on modern HDR or QD-OLED displays, we recommend downloading in lossless PNG or high-quality WebP via the Smart Download panel on each wallpaper page. Both formats preserve subtle twilight gradient transitions without introducing 8-bit JPEG blocking along the magenta-to-indigo sky band.",
    ],
    wallpaperSlugs: [
      "vice-boulevard-twilight-4k",
      "leonida-ocean-drive-neon",
      "miami-palm-silhouette-ultrawide",
      "vice-midnight-supercar-mobile",
      "neon-marina-afterglow-4k",
    ],
    tags: ["vice city", "gta 6 aesthetic", "neon", "sunset", "4k"],
  },
  {
    slug: "true-oled-obsidian-essentials",
    title: "True OLED Obsidian Essentials",
    subtitle: "Infinite contrast, zero visual clutter, and pure #000000 black fields",
    curator: "Trendy-Wallpapers Display Lab",
    updatedAt: "2026-11-14",
    accentHex: "#A855F7",
    commentary: [
      "Owning an OLED monitor or flagship AMOLED smartphone changes how you evaluate wallpapers. On traditional backlit IPS panels, dark scenes glow faint gray in a dim room; on self-emissive OLED pixels, pure #000000 black physically turns off the subpixels, producing infinite contrast and razor-sharp perceived clarity around luminous edges.",
      "The True OLED Obsidian Essentials pack was assembled around three strict engineering criteria: at least 55 percent deep obsidian or pure black pixel area, smooth anti-aliased light geometry that never shimmers on Pentile or triangular RGB subpixel layouts, and zero embedded text or watermarks.",
      "For smartphone users, these compositions double as practical battery savers—particularly on Always-On Display configurations where minimizing lit pixel area measurably lowers display power draw throughout the day. On desktop QD-OLED and WOLED gaming monitors, the dark peripheral field also reduces eye strain during late-night editing or competitive gaming sessions.",
      "Use our interactive Device Preview stage on any wallpaper in this collection to inspect how your phone's lock screen clock or desktop taskbar sits against the dark negative space before downloading your native pixel resolution.",
    ],
    wallpaperSlugs: [
      "obsidian-prism-ring-oled",
      "void-eclipse-horizon-oled",
      "liquid-mercury-ribbon-oled",
      "minimal-cyan-halo-mobile",
      "monolith-glass-caustics-4k",
    ],
    tags: ["oled", "amoled", "true black", "minimalist", "dark mode"],
  },
  {
    slug: "cyberpunk-battlestation-panoramas",
    title: "Cyberpunk Battlestation Panoramas",
    subtitle: "Wide-format nocturnal megacities engineered for 21:9 & 32:9 desks",
    curator: "Trendy-Wallpapers Curatorial Desk",
    updatedAt: "2026-11-16",
    accentHex: "#00F0FF",
    commentary: [
      "Ultrawide and dual-monitor desks deserve more than cropped 16:9 screenshots. When a standard widescreen wallpaper is stretched across a 3440×1440 or 5120×1440 display, vertical architectural lines tilt, fine rain textures blur, and the focal composition collapses into the bezel gap.",
      "Our Cyberpunk Battlestation Panoramas collection solves that problem with wide-aspect nocturnal megacity scenes composed from the ground up for panoramic framing. Horizontal skyline layers, elevated transit viaducts, and rain-washed neon reflections guide the eye smoothly across the entire desk width.",
      "Each wallpaper pairs cool cyan atmospheric fog with warm coral or magenta accents so your RGB desk peripherals and ambient bias lighting can pull directly from the extracted 5-color hex palette. Click any hex swatch on a wallpaper's detail page to copy the exact color code into your keyboard, mouse, or LED strip controller.",
      "Whether you run a single 34-inch curved ultrawide, a 49-inch super-ultrawide, or a classic 4K primary monitor, our server-side Sharp pipeline crops and exports your exact resolution on the fly with edge CDN caching.",
    ],
    wallpaperSlugs: [
      "neo-kyoto-rain-skyline-ultrawide",
      "cyber-viaduct-monorail-32x9",
      "hologram-alley-reflections-4k",
      "orbital-megastructure-dusk-4k",
      "neon-arcology-vertical-mobile",
    ],
    tags: ["cyberpunk", "ultrawide", "3440x1440", "5120x1440", "battlestation"],
  },
  {
    slug: "gta-v-viral-los-santos-pack",
    title: "GTA V Viral Los Santos Pack",
    subtitle:
      "Twelve official Rockstar press frames that defined the Los Santos look — sunset boulevards, night highways, and Vinewood skies",
    curator: "Trendy-Wallpapers Curatorial Desk",
    updatedAt: "2026-11-23",
    accentHex: "#F59E0B",
    commentary: [
      "Los Santos is the visual ancestor of Leonida, and these twelve screenshots are the frames that have come to define Grand Theft Auto V in the public imagination: the black coupe idling under a peach-and-violet sky, the yellow sports car threading a night highway, three men in suits with rifles, a lighthouse alone in turquoise water. All twelve are official Rockstar Games press artwork, sourced at their native 3840 × 2160 and labeled Official Press on every detail page. We did not upscale, repaint, or AI-fill any of them, and we added no watermarks or overlaid type.",
      "The pack is sequenced as three movements rather than a flat dump of files. It opens with the boulevard and highway frames that read as pure place — warm dusk, then cold neon — before moving to the character and action shots: the crew, Michael on his balcony, Trevor at the burning trailer, the bridge chase at blue hour. The final third pulls away from the city into the wilds: Paleto's lighthouse, the Alamo Sea biplane, the Mount Chiliad cable-car station, and a dirt biker cutting through foggy redwoods. That arc keeps the pack interesting when it rotates on a desktop instead of six near-identical night skylines.",
      "Each frame earned its place on wallpaper criteria first. The focal subject sits near the center or along a clean horizontal, the corners stay free of high-frequency clutter, and the sky holds a gradient smooth enough to survive 8-bit JPEG without visible banding. Every master is re-encoded at quality 90 with mozjpeg, paired with a 1200-pixel WebP preview for the detail stage and a 480-pixel WebP thumbnail for grids. We also extracted a five-color palette per image, shown as clickable swatches on each wallpaper page, so bias lighting, keyboard backlights, and RGB case fans can be matched to a frame instead of guessed at.",
      "The pack spans an unusually wide luminance range, which is why it rotates well across different panels. Michael's Midnight Call (mean luma 36.7) and Los Santos Night Highway (39.8) are the true-dark picks for OLED and mini-LED monitors, where their near-black shadows and small specular highlights show off per-pixel contrast. Vinewood Sign Skyline (128.1) and Vinewood Hills Golden Hour (108.0) are the bright counterweights, better suited to a glossy laptop panel in a sunlit room. On a 16:10 laptop or a 21:9 ultrawide, Smart Download center-crops the 16:9 master; the Chiliad and Alamo Sea frames have the most forgiving center composition for that crop, while the police chase loses some bridge at the edges.",
      "One note on rights, because it matters more here than in our community-photo packs. These images are © Rockstar Games, published as press material, and presented here as editorial wallpaper curation rather than licensed stock or original artwork. We are not affiliated with Rockstar or Take-Two, every page carries the credit line, and our DMCA page is the route for any rights-holder request. Keeping them in their own clearly labeled pack — instead of blending them into the original-art collection — is deliberate: it keeps the source honest and lets readers filter by provenance.",
    ],
    editorialNotes: [
      {
        slug: "gta5-los-santos-sunset-boulevard-4k",
        note: "A black coupe idles under peach-to-violet dusk on a palm-lined boulevard. The brightest color sits low and centered, so it warms up a desktop without putting glare behind your icons.",
      },
      {
        slug: "gta5-los-santos-night-highway-4k",
        note: "A yellow sports car threads a lamp-lit freeway with the skyline behind it. At a mean luma of 39.8 this is one of the two OLED-first frames in the pack, and the dark road gives desktop icons a natural home.",
      },
      {
        slug: "gta5-michaels-midnight-call-4k",
        note: "Michael takes a call on a balcony above the city, crescent moon and palms behind him. The darkest image here at 36.7 luma, with a cool teal cast that sits comfortably behind a dark-mode editor.",
      },
      {
        slug: "gta5-dusk-police-chase-4k",
        note: "A black muscle car leads cruisers across a bridge at dusk. Warm taillights against blue hour make it the pack's most cinematic action frame without filling the screen with visual noise.",
      },
      {
        slug: "gta5-the-crew-heist-ready-4k",
        note: "Michael, Franklin, and Trevor in suits with rifles — the cleanest character portrait of the set. Muted charcoal and cream tones keep it readable behind translucent windows and docks.",
      },
      {
        slug: "gta5-trevors-sandy-shores-sendoff-4k",
        note: "Trevor watches a trailer burn beneath a desert motel sign. Amber firelight and deep shadows are dramatic without becoming busy, which makes it a strong second-monitor companion.",
      },
      {
        slug: "gta5-vinewood-hills-golden-hour-4k",
        note: "The backs of the Vinewood letters overlook a hazy skyline in golden hour. Sun flare and layered hills give the frame depth, and the open upper sky leaves room for a clock widget.",
      },
      {
        slug: "gta5-vinewood-sign-skyline-4k",
        note: "A daylight view of the sign above the city, and the brightest palette in the collection at 128.1 luma. Best on a glossy or mini-LED panel where punch matters more than black depth.",
      },
      {
        slug: "gta5-paleto-lighthouse-aerial-4k",
        note: "An aerial of the red-and-white Paleto lighthouse against turquoise water and a lone boat. High-key coastal color that breaks up an all-neon desktop rotation.",
      },
      {
        slug: "gta5-alamo-sea-biplane-4k",
        note: "A biplane banks over the Alamo Sea valley at golden hour with a train below. The wide tonal range from field shadow to bright haze suits 4K laptop panels especially well.",
      },
      {
        slug: "gta5-mount-chiliad-sunset-station-4k",
        note: "The cable-car station at sunset, with ridges fading into violet. A centered horizon and calm upper sky make it the most forgiving frame to crop for 16:10 laptops and 21:9 displays.",
      },
      {
        slug: "gta5-foggy-forest-pursuit-4k",
        note: "A dirt biker tears through foggy redwoods with police SUVs behind. Cool fog and warm tail-lights add motion, but the muted palette keeps it from overpowering icons.",
      },
    ],
    wallpaperSlugs: [
      "gta5-los-santos-sunset-boulevard-4k",
      "gta5-los-santos-night-highway-4k",
      "gta5-michaels-midnight-call-4k",
      "gta5-dusk-police-chase-4k",
      "gta5-the-crew-heist-ready-4k",
      "gta5-trevors-sandy-shores-sendoff-4k",
      "gta5-vinewood-hills-golden-hour-4k",
      "gta5-vinewood-sign-skyline-4k",
      "gta5-paleto-lighthouse-aerial-4k",
      "gta5-alamo-sea-biplane-4k",
      "gta5-mount-chiliad-sunset-station-4k",
      "gta5-foggy-forest-pursuit-4k",
    ],
    tags: ["gta 5", "los santos", "official press", "4k", "rockstar", "wallpaper pack"],
  },
];

const RAW_SEED_SPECS: DemoArtSpec[] = [
  {
    id: "11111111-1111-4111-8111-000000000001",
    slug: "vice-boulevard-twilight-4k",
    title: "Vice Boulevard Twilight 4K",
    description:
      "Vice Boulevard Twilight captures the unmistakable humid dusk of a neon-lit coastal avenue right after a summer downpour. Anchored by a glowing magenta-to-cyan setting sun sliced with crisp atmospheric scanlines, the composition transitions smoothly into a deep obsidian foreground where electric reflections shimmer across dark asphalt. Engineered specifically for 4K UHD (3840×2160) desktop monitors, the upper sky maintains calm, uncluttered negative space so desktop shortcuts, widgets, and translucent glass windows remain effortlessly legible. Whether you are styling a GTA 6 inspired battlestation or dialing in a vibrant dark-mode developer workspace, this textless master avoids heavy compression banding and preserves rich color depth across IPS, Mini-LED, and QD-OLED displays. Download natively at 4K or let our Smart Download panel crop cleanly to your exact display resolution in WebP, PNG, or JPG.",
    source_type: "original",
    category_slug: "gta-6-vice-city",
    tags: ["gta 6", "vice city", "neon", "sunset", "4k", "coastal", "textless"],
    dominant_colors: ["#0B0D12", "#FF2E93", "#00F0FF", "#5B21B6", "#1E1B4B"],
    width: 3840,
    height: 2160,
    aspect_ratio: "16:9",
    device_types: ["desktop"],
    downloads_count: 18420,
    views_count: 64210,
    is_textless: true,
    is_oled_dark: false,
    attribution_text: "Original Artwork — Trendy-Wallpapers Studio",
    created_at: "2026-11-18T10:00:00Z",
    motif: "vice",
  },
  {
    id: "11111111-1111-4111-8111-000000000002",
    slug: "leonida-ocean-drive-neon",
    title: "Leonida Ocean Drive Neon",
    description:
      "Inspired by South Florida's iconic waterfront strip after midnight, Leonida Ocean Drive Neon pairs warm coral-magenta hotel sign glow with cool turquoise coastal reflections. Built with strict textless discipline—no distracting logos, no watermarks, and no harsh white hotspots—this 4K widescreen backdrop balances nostalgic coastal warmth with modern dark-mode restraint. The lower third settles into rich obsidian shadows that blend seamlessly behind macOS docks and Windows 11 taskbars, while the central horizon radiates soft electric energy across your monitor. Color-calibrated for wide-gamut DCI-P3 screens, its five extracted dominant hex codes also make an ideal starting palette for matching keyboard backlights and desk LED bias strips.",
    source_type: "ai_generated",
    category_slug: "gta-6-vice-city",
    tags: ["leonida", "vice city", "gta 6", "ocean drive", "ai art", "4k"],
    dominant_colors: ["#090B10", "#F43F5E", "#22D3EE", "#7E22CE", "#172554"],
    width: 3840,
    height: 2160,
    aspect_ratio: "16:9",
    device_types: ["desktop"],
    downloads_count: 14290,
    views_count: 51800,
    is_textless: true,
    is_oled_dark: false,
    attribution_text: "AI Generated via Fal.ai FLUX — Curated by Trendy-Wallpapers",
    created_at: "2026-11-17T18:30:00Z",
    motif: "vice",
  },
  {
    id: "11111111-1111-4111-8111-000000000003",
    slug: "neon-marina-afterglow-4k",
    title: "Neon Marina Afterglow 4K",
    description:
      "Neon Marina Afterglow frames a calm coastal harbor moments after sunset, where violet twilight clouds fade into deep indigo night above mirror-smooth water. Subtle electric pink and cyan light trails dance across the horizon, delivering a refined Vice City mood that feels cinematic without overwhelming your workspace. Originally mastered at 3840×2160, the scene preserves crisp silhouette geometry and smooth tonal roll-off so 10-bit HDR monitors render zero posterization. Because the composition is completely textless and visually anchored along the center-lower axis, it adapts cleanly to both standard 16:9 laptops and 16:10 creator displays.",
    source_type: "official_press",
    category_slug: "gta-6-vice-city",
    tags: ["marina", "vice city", "twilight", "gaming", "4k", "official press"],
    dominant_colors: ["#0B0D12", "#EC4899", "#06B6D4", "#4C1D95", "#0F172A"],
    width: 3840,
    height: 2160,
    aspect_ratio: "16:9",
    device_types: ["desktop"],
    downloads_count: 11850,
    views_count: 42900,
    is_textless: true,
    is_oled_dark: false,
    attribution_text: "Official Press Kit — Editorial Curation by Trendy-Wallpapers",
    created_at: "2026-11-16T14:20:00Z",
    motif: "horizon",
  },
  {
    id: "11111111-1111-4111-8111-000000000004",
    slug: "vice-midnight-supercar-mobile",
    title: "Vice Midnight Horizon Mobile",
    description:
      "Tailored specifically for tall 9:16 AMOLED smartphones, Vice Midnight Horizon Mobile places a bold magenta-and-cyan coastal twilight low on the canvas while leaving the upper third in a serene deep-indigo gradient. That intentional lock screen clock margin ensures iOS depth-effect typography and Android Material You widgets remain immediately readable without clashing against bright highlights. Rendered at crisp 1440×3200 QHD+ mobile resolution, it scales flawlessly across iPhone Pro Max, Samsung Galaxy S Ultra, and Google Pixel Pro panels while maintaining vibrant neon punch.",
    source_type: "original",
    category_slug: "gta-6-vice-city",
    tags: ["mobile", "vice city", "lock screen", "amoled", "9:16", "neon"],
    dominant_colors: ["#0B0D12", "#FF2E93", "#00F0FF", "#6D28D9", "#1E293B"],
    width: 1440,
    height: 3200,
    aspect_ratio: "9:16",
    device_types: ["mobile"],
    downloads_count: 16340,
    views_count: 58920,
    is_textless: true,
    is_oled_dark: false,
    attribution_text: "Original Artwork — Trendy-Wallpapers Studio",
    created_at: "2026-11-15T11:10:00Z",
    motif: "vice",
  },
  {
    id: "11111111-1111-4111-8111-000000000005",
    slug: "neo-kyoto-rain-skyline-ultrawide",
    title: "Neo-Kyoto Rain Skyline 21:9",
    description:
      "Composed natively at 3440×1440 for 21:9 curved ultrawide monitors, Neo-Kyoto Rain Skyline immerses your desk in a nocturnal cyberpunk metropolis drenched in neon mist. Towering obsidian arcologies rise across the panoramic horizon, punctuated by razor-sharp cyan and hot-pink light strips that reflect softly across the rain-glazed lower canvas. Unlike cropped 16:9 images that lose vertical scale on ultrawide displays, every architectural proportion here was designed for wide peripheral sightlines. Ideal for dark-mode coding setups, sim-rig desks, and dual-pane productivity workflows.",
    source_type: "original",
    category_slug: "cyberpunk",
    tags: ["cyberpunk", "ultrawide", "3440x1440", "21:9", "neon city", "rain"],
    dominant_colors: ["#07090F", "#00F0FF", "#FF2E93", "#1E1B4B", "#0F172A"],
    width: 3440,
    height: 1440,
    aspect_ratio: "21:9",
    device_types: ["ultrawide", "desktop"],
    downloads_count: 15120,
    views_count: 49300,
    is_textless: true,
    is_oled_dark: true,
    attribution_text: "Original Artwork — Trendy-Wallpapers Studio",
    created_at: "2026-11-14T16:45:00Z",
    motif: "cyberpunk",
  },
  {
    id: "11111111-1111-4111-8111-000000000006",
    slug: "hologram-alley-reflections-4k",
    title: "Hologram Alley Reflections 4K",
    description:
      "Hologram Alley Reflections brings moody futuristic atmosphere to standard 4K UHD monitors with layered skyscraper silhouettes and atmospheric cyan-violet volumetric fog. The composition keeps high-frequency visual detail concentrated around the mid-frame architecture while letting the upper sky and lower reflection zone breathe cleanly. That deliberate pacing ensures icons, system menus, and floating widgets never get lost in visual noise. Verified textless and optimized for deep contrast on both OLED and local-dimming Mini-LED displays.",
    source_type: "ai_generated",
    category_slug: "cyberpunk",
    tags: ["cyberpunk", "hologram", "sci-fi", "4k", "dark", "ai art"],
    dominant_colors: ["#080A12", "#38BDF8", "#E879F9", "#312E81", "#0F172A"],
    width: 3840,
    height: 2160,
    aspect_ratio: "16:9",
    device_types: ["desktop"],
    downloads_count: 9840,
    views_count: 35600,
    is_textless: true,
    is_oled_dark: true,
    attribution_text: "AI Generated via Fal.ai FLUX — Curated by Trendy-Wallpapers",
    created_at: "2026-11-13T09:15:00Z",
    motif: "cyberpunk",
  },
  {
    id: "11111111-1111-4111-8111-000000000007",
    slug: "orbital-megastructure-dusk-4k",
    title: "Orbital Megastructure Dusk 4K",
    description:
      "Blending hard-surface sci-fi scale with serene twilight color grading, Orbital Megastructure Dusk frames a sweeping futuristic skyline under dual-tone cyan and magenta atmospheric haze. Mastered at 3840×2160, it delivers crisp architectural edges without oversharpened halos. Its balanced dark luminance makes it comfortable for extended night-time sessions, while the subtle neon reflections add unmistakable character to minimalist dark-mode desktops.",
    source_type: "official_press",
    category_slug: "cyberpunk",
    tags: ["sci-fi", "cyberpunk", "megastructure", "4k", "gaming"],
    dominant_colors: ["#0B0D12", "#06B6D4", "#F43F5E", "#3B0764", "#1E293B"],
    width: 3840,
    height: 2160,
    aspect_ratio: "16:9",
    device_types: ["desktop"],
    downloads_count: 8420,
    views_count: 29400,
    is_textless: true,
    is_oled_dark: true,
    attribution_text: "Official Press Kit — Editorial Curation by Trendy-Wallpapers",
    created_at: "2026-11-12T13:00:00Z",
    motif: "cyberpunk",
  },
  {
    id: "11111111-1111-4111-8111-000000000008",
    slug: "neon-arcology-vertical-mobile",
    title: "Neon Arcology Vertical AMOLED",
    description:
      "Crafted for tall flagship smartphone displays, Neon Arcology Vertical AMOLED stacks rain-streaked futuristic towers into the lower two-thirds of a 1440×3200 canvas. The upper atmospheric void stays dark and clean so your lock screen clock, date, and live activities pop with crisp legibility. Deep charcoal and pitch-black tower faces conserve AMOLED battery power while cyan and magenta architectural strips showcase HDR peak brightness.",
    source_type: "ai_generated",
    category_slug: "cyberpunk",
    tags: ["cyberpunk", "mobile", "amoled", "9:16", "vertical", "ai art"],
    dominant_colors: ["#05070B", "#00F0FF", "#FF2E93", "#1E1B4B", "#0F172A"],
    width: 1440,
    height: 3200,
    aspect_ratio: "9:16",
    device_types: ["mobile"],
    downloads_count: 10910,
    views_count: 38120,
    is_textless: true,
    is_oled_dark: true,
    attribution_text: "AI Generated via Fal.ai FLUX — Curated by Trendy-Wallpapers",
    created_at: "2026-11-11T20:05:00Z",
    motif: "cyberpunk",
  },
  {
    id: "11111111-1111-4111-8111-000000000009",
    slug: "obsidian-prism-ring-oled",
    title: "Obsidian Prism Ring True OLED",
    description:
      "Obsidian Prism Ring is engineered from the first pixel for self-emissive OLED and AMOLED screens. Over 78 percent of the 3840×2160 frame is pure #000000 black, allowing OLED subpixels to switch off completely for infinite contrast and zero backlight bloom. Centered in the void, a precision luminous ring transitions smoothly from electric magenta through cyan to deep ultraviolet, creating a crisp focal centerpiece that looks surgical on QD-OLED gaming monitors and dark-mode MacBooks alike.",
    source_type: "original",
    category_slug: "minimalist-oled",
    tags: ["oled", "true black", "minimalist", "4k", "geometric", "dark"],
    dominant_colors: ["#000000", "#FF2E93", "#00F0FF", "#A855F7", "#111827"],
    width: 3840,
    height: 2160,
    aspect_ratio: "16:9",
    device_types: ["desktop"],
    downloads_count: 21450,
    views_count: 74900,
    is_textless: true,
    is_oled_dark: true,
    attribution_text: "Original Artwork — Trendy-Wallpapers Display Lab",
    created_at: "2026-11-18T08:00:00Z",
    motif: "oled",
  },
  {
    id: "11111111-1111-4111-8111-000000000010",
    slug: "void-eclipse-horizon-oled",
    title: "Void Eclipse Horizon OLED",
    description:
      "Minimalist restraint meets luminous precision in Void Eclipse Horizon OLED. A pitch-black cosmic field frames a razor-thin glowing eclipse ring accented by subtle teal and violet edge caustics. Designed specifically to eliminate desktop distractions while highlighting the extreme contrast ratio of modern OLED panels, this 4K wallpaper pairs effortlessly with minimal window managers, tiling desktops, and distraction-free writing environments.",
    source_type: "original",
    category_slug: "minimalist-oled",
    tags: ["oled", "eclipse", "minimalist", "true black", "4k"],
    dominant_colors: ["#000000", "#00F0FF", "#8B5CF6", "#EC4899", "#0B0D12"],
    width: 3840,
    height: 2160,
    aspect_ratio: "16:9",
    device_types: ["desktop"],
    downloads_count: 13200,
    views_count: 45800,
    is_textless: true,
    is_oled_dark: true,
    attribution_text: "Original Artwork — Trendy-Wallpapers Display Lab",
    created_at: "2026-11-10T15:30:00Z",
    motif: "oled",
  },
  {
    id: "11111111-1111-4111-8111-000000000011",
    slug: "minimal-cyan-halo-mobile",
    title: "Minimal Cyan Halo Mobile OLED",
    description:
      "Built for maximum battery efficiency and razor-sharp lock screen readability, Minimal Cyan Halo Mobile OLED surrounds a crisp luminous halo with pure #000000 black space. The ring sits gracefully below the smartphone clock area so notifications never collide with bright pixels, while the delicate electric cyan and magenta edge glow brings your AMOLED display to life every time you wake your phone.",
    source_type: "original",
    category_slug: "minimalist-oled",
    tags: ["amoled", "oled", "mobile", "minimalist", "true black", "9:16"],
    dominant_colors: ["#000000", "#00F0FF", "#FF2E93", "#6366F1", "#090B10"],
    width: 1440,
    height: 3200,
    aspect_ratio: "9:16",
    device_types: ["mobile"],
    downloads_count: 17680,
    views_count: 61400,
    is_textless: true,
    is_oled_dark: true,
    attribution_text: "Original Artwork — Trendy-Wallpapers Display Lab",
    created_at: "2026-11-09T12:00:00Z",
    motif: "oled",
  },
  {
    id: "11111111-1111-4111-8111-000000000012",
    slug: "liquid-mercury-ribbon-oled",
    title: "Liquid Mercury Ribbon OLED",
    description:
      "Liquid Mercury Ribbon OLED suspends a single flowing strand of refractive dark glass across a deep obsidian canvas. Specular white highlights trace the curve's crest while soft cyan and magenta caustics glow beneath the ribbon, giving your screen tactile three-dimensional depth without cluttering the corners. Mastered at 4K UHD for crisp edge rendering on high-PPI Retina and OLED displays.",
    source_type: "ai_generated",
    category_slug: "minimalist-oled",
    tags: ["liquid glass", "oled", "minimalist", "abstract", "4k", "ai art"],
    dominant_colors: ["#05060A", "#38BDF8", "#F472B6", "#6366F1", "#1E293B"],
    width: 3840,
    height: 2160,
    aspect_ratio: "16:9",
    device_types: ["desktop"],
    downloads_count: 12110,
    views_count: 41200,
    is_textless: true,
    is_oled_dark: true,
    attribution_text: "AI Generated via Fal.ai FLUX — Curated by Trendy-Wallpapers",
    created_at: "2026-11-08T17:40:00Z",
    motif: "liquid",
  },
  {
    id: "11111111-1111-4111-8111-000000000013",
    slug: "miami-palm-silhouette-ultrawide",
    title: "Vice Coastal Horizon 21:9",
    description:
      "Engineered natively at 3440×1440 for curved 21:9 ultrawide monitors, Vice Coastal Horizon stretches a luminous magenta-and-cyan twilight bay across your entire peripheral field. Dark coastal ridges anchor the left and right edges while the glowing sunset sits squarely at visual center, creating balanced symmetry across wide gaming and creative desks. Zero text, zero watermarks, and smooth wide-gamut gradients.",
    source_type: "original",
    category_slug: "ultrawide",
    tags: ["ultrawide", "21:9", "3440x1440", "vice city", "sunset", "neon"],
    dominant_colors: ["#0B0D12", "#FF2E93", "#00F0FF", "#6D28D9", "#1E1B4B"],
    width: 3440,
    height: 1440,
    aspect_ratio: "21:9",
    device_types: ["ultrawide", "desktop"],
    downloads_count: 14650,
    views_count: 50100,
    is_textless: true,
    is_oled_dark: false,
    attribution_text: "Original Artwork — Trendy-Wallpapers Studio",
    created_at: "2026-11-07T10:25:00Z",
    motif: "vice",
  },
  {
    id: "11111111-1111-4111-8111-000000000014",
    slug: "cyber-viaduct-monorail-32x9",
    title: "Cyber Viaduct Panorama 32:9",
    description:
      "Built natively at 5120×1440 for 49-inch super-ultrawide monitors and dual-27-inch QHD setups, Cyber Viaduct Panorama spans an unbroken nocturnal skyline with crisp perspective lines leading toward a neon-lit horizon. Even when split across two side-by-side monitors, both left and right halves carry balanced architectural weight and rich cyan-magenta lighting without awkward seam distortion.",
    source_type: "original",
    category_slug: "ultrawide",
    tags: ["32:9", "5120x1440", "dual monitor", "super ultrawide", "cyberpunk"],
    dominant_colors: ["#080A10", "#00F0FF", "#FF2E93", "#312E81", "#0F172A"],
    width: 5120,
    height: 1440,
    aspect_ratio: "32:9",
    device_types: ["ultrawide"],
    downloads_count: 11290,
    views_count: 37900,
    is_textless: true,
    is_oled_dark: true,
    attribution_text: "Original Artwork — Trendy-Wallpapers Studio",
    created_at: "2026-11-06T14:00:00Z",
    motif: "horizon",
  },
  {
    id: "11111111-1111-4111-8111-000000000015",
    slug: "nordic-aurora-peaks-ultrawide",
    title: "Nordic Aurora Peaks 21:9",
    description:
      "Nordic Aurora Peaks pairs jagged alpine silhouettes with luminous emerald and violet aurora curtains sweeping across a 3440×1440 ultrawide night sky. Crafted for users who want crisp nocturnal color without sci-fi neon, this panoramic nature scene keeps deep shadow detail clean and glare-free during late-night work or gaming.",
    source_type: "original",
    category_slug: "ultrawide",
    tags: ["aurora", "nature", "ultrawide", "21:9", "3440x1440", "night"],
    dominant_colors: ["#060911", "#10B981", "#38BDF8", "#6366F1", "#1E293B"],
    width: 3440,
    height: 1440,
    aspect_ratio: "21:9",
    device_types: ["ultrawide", "desktop"],
    downloads_count: 9380,
    views_count: 31200,
    is_textless: true,
    is_oled_dark: true,
    attribution_text: "Original Artwork — Trendy-Wallpapers Studio",
    created_at: "2026-11-05T19:15:00Z",
    motif: "aurora",
  },
  {
    id: "11111111-1111-4111-8111-000000000016",
    slug: "aurora-fjord-lockscreen-mobile",
    title: "Aurora Fjord Lock Screen 9:16",
    description:
      "Aurora Fjord Lock Screen frames glowing emerald-to-cyan northern lights arching gracefully beneath a deep starry upper canopy, leaving generous dark breathing room for your phone's lock screen clock. Steep alpine silhouettes anchor the bottom dock area so home screen app icons remain crisp and legible across both light and dark icon packs.",
    source_type: "original",
    category_slug: "mobile",
    tags: ["mobile", "lock screen", "aurora", "nature", "9:16", "amoled"],
    dominant_colors: ["#060A12", "#10B981", "#06B6D4", "#4F46E5", "#1E293B"],
    width: 1440,
    height: 3200,
    aspect_ratio: "9:16",
    device_types: ["mobile"],
    downloads_count: 12740,
    views_count: 44100,
    is_textless: true,
    is_oled_dark: true,
    attribution_text: "Original Artwork — Trendy-Wallpapers Studio",
    created_at: "2026-11-04T08:50:00Z",
    motif: "aurora",
  },
  {
    id: "11111111-1111-4111-8111-000000000017",
    slug: "iridescent-glass-wave-mobile",
    title: "Iridescent Glass Wave Mobile",
    description:
      "Inspired by spatial Liquid Glass interfaces, Iridescent Glass Wave Mobile sweeps a translucent ribbon of rose-gold, cyan, and violet light across a deep obsidian vertical frame. Designed at 1440×3200 for modern OLED smartphones, it complements translucent iOS and Android glass widgets without competing for visual attention.",
    source_type: "ai_generated",
    category_slug: "mobile",
    tags: ["liquid glass", "mobile", "abstract", "9:16", "lock screen", "ai art"],
    dominant_colors: ["#0B0D12", "#FF2E93", "#38BDF8", "#8B5CF6", "#1E293B"],
    width: 1440,
    height: 3200,
    aspect_ratio: "9:16",
    device_types: ["mobile"],
    downloads_count: 15020,
    views_count: 52300,
    is_textless: true,
    is_oled_dark: true,
    attribution_text: "AI Generated via Fal.ai FLUX — Curated by Trendy-Wallpapers",
    created_at: "2026-11-03T15:10:00Z",
    motif: "liquid",
  },
  {
    id: "11111111-1111-4111-8111-000000000018",
    slug: "monolith-glass-caustics-4k",
    title: "Monolith Glass Caustics 4K",
    description:
      "Monolith Glass Caustics brings calm architectural depth to 4K creative workstations. Soft refractive ribbons float across a velvety obsidian background, accented by subtle cyan and magenta specular highlights that echo modern spatial UI glass. Engineered to stay completely distraction-free during long design, coding, or editing sprints while still looking razor-sharp on 27-inch and 32-inch 4K/5K displays.",
    source_type: "original",
    category_slug: "abstract",
    tags: ["abstract", "liquid glass", "4k", "workspace", "dark", "minimalist"],
    dominant_colors: ["#0B0D12", "#00F0FF", "#FF2E93", "#6366F1", "#1E293B"],
    width: 3840,
    height: 2160,
    aspect_ratio: "16:9",
    device_types: ["desktop", "tablet"],
    downloads_count: 10490,
    views_count: 36700,
    is_textless: true,
    is_oled_dark: true,
    attribution_text: "Original Artwork — Trendy-Wallpapers Studio",
    created_at: "2026-11-02T11:30:00Z",
    motif: "liquid",
  },
];

function hydrateSeedSpec(spec: DemoArtSpec, index: number): Wallpaper {
  const thumbWidth = 480;
  const thumbHeight = Math.round((spec.height / spec.width) * thumbWidth);
  const thumbSvg = buildWallpaperSvgMarkup({
    title: spec.title,
    colors: spec.dominant_colors,
    width: thumbWidth,
    height: thumbHeight,
    motif: spec.motif,
    seedIndex: index,
  });

  const previewWidth = 1200;
  const previewHeight = Math.round((spec.height / spec.width) * previewWidth);
  const previewSvg = buildWallpaperSvgMarkup({
    title: spec.title,
    colors: spec.dominant_colors,
    width: previewWidth,
    height: previewHeight,
    motif: spec.motif,
    seedIndex: index,
  });

  return {
    id: spec.id,
    slug: spec.slug,
    title: spec.title,
    description: spec.description,
    source_type: spec.source_type,
    category_slug: spec.category_slug,
    tags: spec.tags,
    dominant_colors: spec.dominant_colors,
    width: spec.width,
    height: spec.height,
    aspect_ratio: spec.aspect_ratio,
    device_types: spec.device_types,
    r2_original_key: `originals/${spec.slug}.png`,
    r2_thumb_key: `thumbs/${spec.slug}.webp`,
    thumb_url: svgToDataUri(thumbSvg),
    preview_url: svgToDataUri(previewSvg),
    downloads_count: spec.downloads_count,
    views_count: spec.views_count,
    is_textless: spec.is_textless,
    is_oled_dark: spec.is_oled_dark,
    attribution_text: spec.attribution_text,
    is_published: true,
    created_at: spec.created_at,
  };
}

export const SEED_WALLPAPERS: Wallpaper[] = RAW_SEED_SPECS.map((spec, idx) =>
  hydrateSeedSpec(spec, idx)
);

// Runtime demo store so AI generations created in demo mode immediately resolve at /wallpaper/[slug].
// Backed by globalThis because Next.js instantiates this module once per bundle
// (route handlers vs. RSC pages), and a module-local array would not be visible to the page.
// Persisted to disk in demo mode so generations survive dev restarts and HMR.
const demoStoreGlobal = globalThis as typeof globalThis & {
  __trendyDemoWallpapers?: Wallpaper[];
  __trendyDemoViewCounts?: Record<string, number>;
};

const DEMO_STORE_MAX = 200;

function demoStorePath(): string {
  // Kept outside .next: that directory is owned by Next's build/cache workers.
  return (
    process.env.DEMO_WALLPAPER_STORE ??
    path.join(process.cwd(), ".demo-wallpapers.json")
  );
}

function readPersistedDemoWallpapers(): Wallpaper[] {
  if (!isDemoMode()) return [];
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(demoStorePath(), "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Wallpaper => Boolean(item && typeof item === "object"))
      .slice(0, DEMO_STORE_MAX);
  } catch {
    return [];
  }
}

async function persistDemoWallpapers(items: Wallpaper[]): Promise<void> {
  if (!isDemoMode()) return;
  try {
    const target = demoStorePath();
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    // Atomic write: a crash mid-write must never leave a truncated JSON blob.
    const tmp = `${target}.tmp`;
    // Persist the same window the process keeps, so uploads never disappear on restart.
    await fs.promises.writeFile(tmp, JSON.stringify(items));
    await fs.promises.rename(tmp, target);
  } catch {
    // Demo persistence is best-effort; an unwritable cache must not break generation.
  }
}

const runtimeDemoWallpapers: Wallpaper[] = (demoStoreGlobal.__trendyDemoWallpapers ??=
  readPersistedDemoWallpapers());

// View increments stay in memory: they change on every visit, so persisting them to disk
// would rewrite the whole demo store per page view. globalThis keeps them visible across
// the RSC and route-handler bundles.
const demoViewCounts: Record<string, number> = (demoStoreGlobal.__trendyDemoViewCounts ??=
  {});

export async function registerDemoWallpaper(wallpaper: Wallpaper): Promise<void> {
  runtimeDemoWallpapers.unshift(wallpaper);
  if (runtimeDemoWallpapers.length > DEMO_STORE_MAX) {
    runtimeDemoWallpapers.length = DEMO_STORE_MAX;
  }
  await persistDemoWallpapers(runtimeDemoWallpapers);
}

/** Returns false when no published demo row matches, so the route cannot claim a count. */
export function incrementDemoWallpaperViews(wallpaperId: string): boolean {
  const exists =
    runtimeDemoWallpapers.some((item) => item.id === wallpaperId) ||
    GTA5_VIRAL_WALLPAPERS.some((item) => item.id === wallpaperId) ||
    CURATED_WALLPAPERS.some((item) => item.id === wallpaperId) ||
    SEED_WALLPAPERS.some((item) => item.id === wallpaperId);
  if (!exists) return false;

  demoViewCounts[wallpaperId] = (demoViewCounts[wallpaperId] ?? 0) + 1;
  return true;
}

export function getDemoWallpapers(): Wallpaper[] {
  const catalog = [
    ...runtimeDemoWallpapers,
    ...GTA5_VIRAL_WALLPAPERS,
    ...CURATED_WALLPAPERS,
    ...SEED_WALLPAPERS,
  ];
  return catalog.map((wallpaper) => {
    const extraViews = demoViewCounts[wallpaper.id];
    return extraViews
      ? { ...wallpaper, views_count: wallpaper.views_count + extraViews }
      : wallpaper;
  });
}

const CURATED_ORIGINALS_DIR = path.join(process.cwd(), "public", "curated", "originals");

/** Overridable so isolated tests never write the developer's real upload folder. */
function uploadRoot(): string {
  return process.env.DEMO_UPLOAD_DIR?.trim() || path.join(process.cwd(), ".uploads");
}

/** Reads a source-controlled curated original (path-traversal-safe). */
export async function readCuratedOriginal(originalKey: string): Promise<Buffer | null> {
  const name = path.basename(originalKey);
  if (!/^[a-z0-9-]+\.(jpg|png|webp)$/.test(name)) return null;
  try {
    return await fs.promises.readFile(path.join(CURATED_ORIGINALS_DIR, name));
  } catch {
    return null;
  }
}

/**
 * Demo-mode storage for real uploaded artwork so it is viewable without R2.
 * Originals and thumbnails live in separate directories: a WebP original and its
 * WebP thumbnail must never share a filename.
 */
export async function saveLocalUpload(
  slug: string,
  extension: "jpg" | "png" | "webp",
  original: Buffer,
  thumb: Buffer
): Promise<{ originalKey: string; thumbKey: string }> {
  if (!isDemoMode()) throw new Error("Local upload storage is only used in demo mode.");
  const safeSlug = slug.replace(/[^a-z0-9-]/g, "");
  const root = uploadRoot();
  const originalsDir = path.join(root, "originals");
  const thumbsDir = path.join(root, "thumbs");
  await Promise.all([
    fs.promises.mkdir(originalsDir, { recursive: true }),
    fs.promises.mkdir(thumbsDir, { recursive: true }),
  ]);
  await Promise.all([
    fs.promises.writeFile(path.join(originalsDir, `${safeSlug}.${extension}`), original),
    fs.promises.writeFile(path.join(thumbsDir, `${safeSlug}.webp`), thumb),
  ]);
  return {
    originalKey: `originals/${safeSlug}.${extension}`,
    thumbKey: `thumbs/${safeSlug}.webp`,
  };
}

/**
 * Resolves an original/thumbnail key against locally stored demo uploads. Prefixed
 * directories are authoritative; the flat root is a read-only compatibility path for
 * uploads written before the layout split.
 */
export async function readLocalUpload(originalKey: string): Promise<Buffer | null> {
  const name = path.basename(originalKey);
  if (!/^[a-z0-9-]+\.(jpg|png|webp)$/.test(name)) return null;
  const prefix = originalKey.replace(/^\/+/, "").split("/")[0];
  const root = uploadRoot();
  const candidates = prefix === "originals" || prefix === "thumbs"
    ? [path.join(root, prefix, name), path.join(root, name)]
    : [path.join(root, name)];
  for (const candidate of candidates) {
    try {
      return await fs.promises.readFile(candidate);
    } catch {
      // Try the next layout candidate.
    }
  }
  return null;
}

const demoSvgCache = new Map<string, string>();

export function getDemoArtSvgForSlug(
  slug: string,
  targetWidth?: number,
  targetHeight?: number
): string | null {
  const index = RAW_SEED_SPECS.findIndex((spec) => spec.slug === slug);
  const spec = index >= 0
    ? RAW_SEED_SPECS[index]
    : runtimeDemoWallpapers.find((wallpaper) => wallpaper.slug === slug);
  if (!spec) return null;

  const width = targetWidth ?? (targetHeight
    ? Math.round(targetHeight * spec.width / spec.height)
    : Math.min(spec.width, 1920));
  const height = targetHeight ?? Math.round(width * spec.height / spec.width);
  const key = `${spec.id}:${width}:${height}`;
  const cached = demoSvgCache.get(key);
  if (cached) return cached;

  const svg = buildWallpaperSvgMarkup({
    title: spec.title,
    colors: spec.dominant_colors,
    width,
    height,
    motif: "motif" in spec ? spec.motif : spec.is_oled_dark ? "oled" : "vice",
    seedIndex: index >= 0 ? index : spec.slug.length,
  });
  if (demoSvgCache.size >= 64) demoSvgCache.delete(demoSvgCache.keys().next().value!);
  demoSvgCache.set(key, svg);
  return svg;
}
