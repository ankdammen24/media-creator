export type ShareData = {
  url: string;
  title: string;
  text?: string;
};

export function buildShareIntents({ url, title, text }: ShareData) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const body = encodeURIComponent(text ? `${text}\n\n${url}` : url);
  const titleAndText = encodeURIComponent(text ? `${title} — ${text}` : title);
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    twitter: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    whatsapp: `https://wa.me/?text=${body}`,
    telegram: `https://t.me/share/url?url=${u}&text=${t}`,
    threads: `https://www.threads.net/intent/post?text=${titleAndText}%20${u}`,
    reddit: `https://www.reddit.com/submit?url=${u}&title=${t}`,
    email: `mailto:?subject=${t}&body=${body}`,
  };
}

export function absoluteUrl(path: string): string {
  if (typeof window !== "undefined") {
    return new URL(path, window.location.origin).toString();
  }
  return `https://catalog.mediarosenqvist.com${path.startsWith("/") ? path : `/${path}`}`;
}