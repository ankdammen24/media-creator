import {
  Music2,
  Apple,
  Youtube,
  Video,
  Facebook,
  ShoppingBag,
  Headphones,
  Waves,
  Disc3,
  Radio,
  type LucideIcon,
} from "lucide-react";

export type PlatformCode =
  | "spotify"
  | "apple_music"
  | "youtube_music"
  | "tiktok"
  | "meta"
  | "amazon_music"
  | "deezer"
  | "tidal"
  | "beatport"
  | "pandora";

export type Platform = {
  code: PlatformCode;
  name: string;
  icon: LucideIcon;
  hint: string;
};

export const PLATFORMS: Platform[] = [
  { code: "spotify", name: "Spotify", icon: Music2, hint: "Världens största streamingtjänst" },
  { code: "apple_music", name: "Apple Music", icon: Apple, hint: "Apples musiktjänst & iTunes Store" },
  { code: "youtube_music", name: "YouTube Music", icon: Youtube, hint: "Inklusive Content ID" },
  { code: "tiktok", name: "TikTok", icon: Video, hint: "Ljudbibliotek för creators" },
  { code: "meta", name: "Instagram / Facebook", icon: Facebook, hint: "Reels & Stories" },
  { code: "amazon_music", name: "Amazon Music", icon: ShoppingBag, hint: "Prime & Unlimited" },
  { code: "deezer", name: "Deezer", icon: Headphones, hint: "Global streamingtjänst" },
  { code: "tidal", name: "Tidal", icon: Waves, hint: "Hi-Fi & MQA" },
  { code: "beatport", name: "Beatport", icon: Disc3, hint: "Electronic & DJ-marknad" },
  { code: "pandora", name: "Pandora", icon: Radio, hint: "USA-marknaden" },
];

export function platformName(code: string): string {
  return PLATFORMS.find((p) => p.code === code)?.name ?? code;
}