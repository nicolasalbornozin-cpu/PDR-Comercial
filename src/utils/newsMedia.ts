// Never sign an external URL or decode a path into a different bucket.
export function newsMediaPath(value: string | undefined, origin: string | undefined): string | undefined {
  if (!value || !origin) return undefined;
  try {
    const url = new URL(value);
    if (url.origin !== new URL(origin).origin) return undefined;
    const match = /^\/storage\/v1\/object\/(?:public|sign|authenticated)\/news-media\/(.+)$/.exec(url.pathname);
    if (!match) return undefined;
    const path = decodeURIComponent(match[1]);
    return /^(articles|gallery)\/[A-Za-z0-9._-]+$/.test(path) && !path.includes('..') ? path : undefined;
  } catch { return undefined; }
}
