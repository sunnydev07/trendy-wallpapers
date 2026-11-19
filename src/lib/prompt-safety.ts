import type { AiStylePreset } from "@/types/wallpaper";

export const AI_STYLE_PRESETS: AiStylePreset[] = [
  {
    id: "vice-city-neon",
    name: "Vice City Neon",
    tagline: "Hot magenta sunset, humid palm silhouettes, wet asphalt reflections",
    promptSuffix:
      "Vice City neon aesthetic, sunset twilight over coastal boulevard, glowing magenta #FF2E93 and electric cyan #00F0FF reflections on wet asphalt, cinematic ray-traced lighting, ultra-detailed 8k wallpaper, clean textless composition",
    accentHex: "#FF2E93",
    categorySlug: "gta-6-vice-city",
    isOledDark: false,
  },
  {
    id: "cyberpunk-rain",
    name: "Cyberpunk Rain",
    tagline: "Futuristic megacity skyline, rain streaks, volumetric hologram glow",
    promptSuffix:
      "cyberpunk night skyline in heavy rain, volumetric cyan and amber neon fog, reflective glass skyscrapers, blade runner cinematography, hyper-sharp 8k wallpaper, zero text or logos",
    accentHex: "#00F0FF",
    categorySlug: "cyberpunk",
    isOledDark: true,
  },
  {
    id: "minimalist-oled",
    name: "Minimalist OLED",
    tagline: "True #000000 black negative space with luminous geometric light",
    promptSuffix:
      "minimalist true black OLED wallpaper, 70% pure pitch black #000000 background for zero pixel power draw, single luminous neon prism edge lighting, crisp studio render, ultra clean, no text",
    accentHex: "#A855F7",
    categorySlug: "minimalist-oled",
    isOledDark: true,
  },
  {
    id: "synthwave-horizon",
    name: "Synthwave Horizon",
    tagline: "Retrowave twilight grid, chrome supercar vibes, atmospheric mountains",
    promptSuffix:
      "modern retrowave synthwave dusk, sleek coastal highway leading toward glowing horizon, violet and coral gradient sky, cinematic anamorphic lens flare, high contrast 8k wallpaper, completely textless",
    accentHex: "#F97316",
    categorySlug: "gaming",
    isOledDark: false,
  },
  {
    id: "liquid-glass-dark",
    name: "Liquid Glass Dark",
    tagline: "Refractive obsidian glass ribbons, subtle iridescent specular edges",
    promptSuffix:
      "abstract dark liquid glass sculpture floating in deep obsidian void, subtle cyan and rose caustics, studio macro photography, Apple spatial glass aesthetic, ultra sharp 8k wallpaper, no text",
    accentHex: "#38BDF8",
    categorySlug: "abstract",
    isOledDark: true,
  },
  {
    id: "alpine-night-sky",
    name: "Alpine Night Sky",
    tagline: "Crisp astrophotography peaks under deep aurora and starfields",
    promptSuffix:
      "dramatic alpine mountain peaks at night under subtle emerald and violet aurora borealis, razor-sharp starfield, calm mirror lake reflection, 8k nature photography wallpaper, textless",
    accentHex: "#10B981",
    categorySlug: "nature",
    isOledDark: true,
  },
];

// Blocked terms covering NSFW, gore, explicit violence, hate, self-harm, and AdSense-restricted topics
const BLOCKED_TERMS: RegExp[] = [
  /\b(nsfw|nude|nudity|naked|porn|pornography|hentai|erotic|explicit|fetish|xxx|lingerie|topless|genitals)\b/i,
  /\b(gore|gory|bloodbath|dismember|behead|decapitat|mutilat|corpse|slaughter|torture|brutal murder)\b/i,
  /\b(suicide|self[- ]?harm|overdose|terroris[mt]|bomb making|mass shooting)\b/i,
  /\b(nazi|swastika|hate speech|racial slur|white supremacy)\b/i,
  /\b(cocaine|heroin|methamphetamine|drug injection|gambling casino ads)\b/i,
  /\b(child|minor|underage)\s+(sexual|nude|explicit)/i,
];

export interface PromptSafetyResult {
  safe: boolean;
  sanitizedPrompt: string;
  reason?: string;
}

export function sanitizeAndValidatePrompt(rawPrompt: string): PromptSafetyResult {
  const trimmed = rawPrompt
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (trimmed.length < 4) {
    return {
      safe: false,
      sanitizedPrompt: "",
      reason: "Please enter a descriptive prompt of at least 4 characters.",
    };
  }

  if (trimmed.length > 360) {
    return {
      safe: false,
      sanitizedPrompt: trimmed.slice(0, 360),
      reason: "Prompt must be 360 characters or fewer.",
    };
  }

  for (const pattern of BLOCKED_TERMS) {
    if (pattern.test(trimmed)) {
      return {
        safe: false,
        sanitizedPrompt: "",
        reason:
          "This prompt contains restricted or unsafe terms. Please keep prompts family-safe and AdSense-compliant.",
      };
    }
  }

  return {
    safe: true,
    sanitizedPrompt: trimmed,
  };
}

export function getPresetById(presetId: string): AiStylePreset {
  return (
    AI_STYLE_PRESETS.find((preset) => preset.id === presetId) ?? AI_STYLE_PRESETS[0]
  );
}

export function composeWallpaperPrompt(params: {
  userPrompt: string;
  stylePresetId: string;
  aspectRatio: "16:9" | "21:9" | "9:16" | "4:3";
  phoneClockMargin?: boolean;
}): { finalPrompt: string; preset: AiStylePreset } {
  const preset = getPresetById(params.stylePresetId);

  const framingHints: string[] = [
    params.userPrompt,
    preset.promptSuffix,
    "no watermarks, no signatures, no text overlays, edge-to-edge full bleed composition",
  ];

  if (params.aspectRatio === "21:9") {
    framingHints.push("cinematic ultrawide 21:9 panoramic framing");
  }

  if (params.aspectRatio === "9:16" && params.phoneClockMargin) {
    framingHints.push(
      "vertical mobile lock screen framing with clean minimal negative space in the upper 28 percent so smartphone clock widgets remain effortlessly readable, primary focal subject positioned in the lower two-thirds"
    );
  }

  return {
    finalPrompt: framingHints.join(", "),
    preset,
  };
}
