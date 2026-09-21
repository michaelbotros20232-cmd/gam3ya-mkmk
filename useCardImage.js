import { useEffect, useState } from 'react';

// كاش في الذاكرة عشان منبعتش نفس الطلب مرتين في نفس الجلسة
const memCache = new Map();

function readLocalCache(key) {
  try {
    const raw = localStorage.getItem(`imgcache:${key}`);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function writeLocalCache(key, value) {
  try {
    localStorage.setItem(`imgcache:${key}`, JSON.stringify(value));
  } catch {
    // تجاهل لو الـ storage ممتلئ أو غير متاح
  }
}

// بيدور على أول نتيجة بحث في ويكيبيديا العربية وياخد صورتها المصغرة
async function fetchWikiImage(name) {
  const url =
    'https://ar.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=' +
    encodeURIComponent(name) +
    '&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=400&format=json&origin=*';
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    const page = Object.values(pages)[0];
    return page?.thumbnail?.source || null;
  } catch {
    return null;
  }
}

/**
 * بيرجع رابط صورة لاسم الكارت (ممثل/فيلم/مسلسل) مع كاش، أو null لو معندوش صورة
 */
export default function useCardImage(name, enabled) {
  const [src, setSrc] = useState(() => (enabled ? memCache.get(name) : undefined));

  useEffect(() => {
    if (!enabled || !name) return;

    if (memCache.has(name)) {
      setSrc(memCache.get(name));
      return;
    }

    const cached = readLocalCache(name);
    if (cached !== undefined) {
      memCache.set(name, cached);
      setSrc(cached);
      return;
    }

    let cancelled = false;
    fetchWikiImage(name).then((url) => {
      if (cancelled) return;
      memCache.set(name, url);
      writeLocalCache(name, url);
      setSrc(url);
    });

    return () => {
      cancelled = true;
    };
  }, [name, enabled]);

  return src; // undefined = لسه بيحمل، null = معندوش صورة، string = رابط الصورة
}
