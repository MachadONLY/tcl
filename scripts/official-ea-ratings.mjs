import { Window } from 'happy-dom';
import {
  groupFromPositions,
  normalizeName,
  positionTokens
} from './official-football-data.mjs';

function cleanText(value) {
  return String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromSlug(value) {
  return decodeURIComponent(String(value || ''))
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
    .trim();
}

function ratingFromText(value) {
  return Number(cleanText(value).match(/\b(?:OVR|GER|SML)\s*(\d{2})\b/i)?.[1]) || null;
}

function closestRatingCard(anchor) {
  let node = anchor;
  for (let depth = 0; node && depth < 12; depth += 1, node = node.parentElement) {
    const text = cleanText(node.textContent);
    if (text.length <= 1200 && ratingFromText(text)) return node;
  }
  return anchor.parentElement;
}

function addRating(byId, eaPlayerId, slug, name, context) {
  if (!eaPlayerId) return;
  const text = cleanText(context);
  const overall = ratingFromText(text);
  if (!overall) return;
  const cleanName = cleanText(name) || titleFromSlug(slug);
  const position = positionTokens(text).find(token => groupFromPositions(token)) || '';
  byId.set(eaPlayerId, {
    eaPlayerId,
    name: cleanName,
    normalizedName: normalizeName(cleanName),
    position,
    group: groupFromPositions(position),
    overall
  });
}

export function parseOfficialEaRatingsHtml(html) {
  const source = String(html || '').replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
  const byId = new Map();
  const window = new Window({
    settings: {
      disableJavaScriptEvaluation: true,
      disableJavaScriptFileLoading: true,
      disableCSSFileLoading: true,
      disableIframePageLoading: true
    }
  });
  window.document.write(source);

  for (const anchor of window.document.querySelectorAll('a[href*="/ratings/player-ratings/"]')) {
    const href = anchor.getAttribute('href') || '';
    const match = href.match(/\/ratings\/player-ratings\/([^/?#]+)\/(\d+)/i);
    if (!match) continue;
    const card = closestRatingCard(anchor);
    addRating(byId, Number(match[2]), match[1], anchor.textContent, card?.outerHTML || card?.textContent || '');
  }
  window.close();

  const rawMatches = [...source.matchAll(/<a\b[^>]*href=["'][^"']*\/ratings\/player-ratings\/([^/?#"']+)\/(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for (let index = 0; index < rawMatches.length; index += 1) {
    const match = rawMatches[index];
    const start = match.index ?? 0;
    const nextStart = rawMatches[index + 1]?.index ?? Math.min(source.length, start + 2500);
    const context = source.slice(start, nextStart);
    if (!byId.has(Number(match[2]))) {
      addRating(byId, Number(match[2]), match[1], cleanText(match[3]), context);
    }
  }

  return [...byId.values()];
}
