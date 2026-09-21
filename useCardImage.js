import { useEffect, useState } from 'react';
import { TMDB_API_KEY, TMDB_IMG_BASE } from './tmdbConfig.js';

// كاش في الذاكرة عشان منبعتش نفس الطلب مرتين في نفس الجلسة
const memCache = new Map();

function cacheKey(name, type) {
  return `${type}:${name}`;
}

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

// بيحدد نوع البحث في TMDb حسب نوع الكارت
function endpointFor(type) {
  if (type === 'actor') return 'search/person';
  if (type === 'movie') return 'search/movie';
  if (type === 'series') return 'search/tv';
  return null;
}

async function searchTmdb(endpoint, name, language) {
  const url =
    `https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_API_KEY}` +
    `&query=${encodeURIComponent(name)}` +
    (language ? `&language=${language}` : '');

  const res = await fetch(url);
  if (!res.ok) {
    // بيطبع السبب الحقيقي في الكونسول (401 = المفتاح غلط، 404/غيره = مشكلة تانية)
    console.error(`[TMDb] "${name}" (${endpoint}) → HTTP ${res.status}`);
    return null;
  }
  const data = await res.json();
  return data?.results?.[0] || null;
}

async function fetchTmdbImage(name, type) {
  const endpoint = endpointFor(type);
  if (!endpoint) return null;

  // الاسم من غير أي حاجة بين قوسين (زي "(شيكو)") عشان تزود فرصة المطابقة
  const cleanName = name.replace(/\s*\([^)]*\)\s*/g, '').trim();

  try {
    // أولاً بالعربي، ولو معندوش نتيجة جرب من غير باراميتر اللغة (بعض الأسماء مش متسجلة بالعربي في TMDb)
    let result = await searchTmdb(endpoint, cleanName, 'ar');
    if (!result) result = await searchTmdb(endpoint, cleanName, null);

    if (!result) return null;
    const path = result.profile_path || result.poster_path;
    return path ? `${TMDB_IMG_BASE}${path}` : null;
  } catch (err) {
    console.error(`[TMDb] فشل الطلب لـ "${name}":`, err);
    return null;
  }
}

/**
 * بيرجع رابط صورة لاسم الكارت (ممثل/فيلم/مسلسل) من TMDb مع كاش، أو null لو معندوش صورة
 */
export default function useCardImage(name, type, enabled) {
  const key = enabled ? cacheKey(name, type) : null;
  const [src, setSrc] = useState(() => (key ? memCache.get(key) : undefined));

  useEffect(() => {
    if (!enabled || !name || !type) return;
    const key = cacheKey(name, type);

    if (memCache.has(key)) {
      setSrc(memCache.get(key));
      return;
    }

    // بنستخدم الكاش المحفوظ بس لو فيه صورة فعلاً؛ مش بنثبّت "معندوش صورة" للأبد،
    // عشان لو المفتاح كان متعطل أو فيه مشكلة مؤقتة، أول ما تتصلح هتترفتش تاني بدل ما تفضل فاضية دايمًا
    const cached = readLocalCache(key);
    if (cached) {
      memCache.set(key, cached);
      setSrc(cached);
      return;
    }

    let cancelled = false;
    fetchTmdbImage(name, type).then((url) => {
      if (cancelled) return;
      memCache.set(key, url);
      if (url) writeLocalCache(key, url); // نحفظ في localStorage الصور اللي لقيناها بس
      setSrc(url);
    });

    return () => {
      cancelled = true;
    };
  }, [name, type, enabled]);

  return src; // undefined = لسه بيحمل، null = معندوش صورة، string = رابط الصورة
}
