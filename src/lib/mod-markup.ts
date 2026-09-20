/** Nexus / Steam BBCode + leftover HTML → safe HTML for the Discover full view. */

const SIZE_REM: Record<number, string> = {
  1: "0.75rem",
  2: "0.875rem",
  3: "1rem",
  4: "1.15rem",
  5: "1.4rem",
  6: "1.7rem",
  7: "2rem",
};

const NAMED_COLORS = new Set([
  "white",
  "black",
  "red",
  "green",
  "blue",
  "yellow",
  "orange",
  "purple",
  "gray",
  "grey",
  "cyan",
  "magenta",
  "silver",
  "navy",
]);

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;");
}

function decodeAmp(s: string) {
  return s.replace(/\u0026amp;/g, "&").replace(/\u0026quot;/g, "");
}

function safeHref(raw: string) {
  const u = decodeAmp(raw.trim()).replace(/^['"]|['"]$/g, "");
  if (/^https?:\/\//i.test(u)) return escapeHtml(u);
  return "";
}

function safeColor(raw: string) {
  const c = raw.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c)) return c;
  if (NAMED_COLORS.has(c.toLowerCase())) return c.toLowerCase();
  return "";
}

function looksLikeHtml(s: string) {
  return /<\/?(p|div|br|h[1-6]|ul|ol|li|span|strong|em|a|img|table|blockquote)\b/i.test(s);
}

function convertLists(s: string) {
  return s.replace(/\[list(?:=(1|a|A))?\]([\s\S]*?)\[\/list\]/gi, (_m, type, inner: string) => {
    const items = inner
      .split(/\[\*\]/)
      .map((x) => x.replace(/^[\s\r\n]+|[\s\r\n]+$/g, "").replace(/<br\s*\/?>$/i, ""))
      .filter(Boolean);
    const tag = type === "1" || type === "a" || type === "A" ? "ol" : "ul";
    if (!items.length) return "";
    return `<${tag}>${items.map((i) => `<li>${i}</li>`).join("")}</${tag}>`;
  });
}

function convertInline(s: string) {
  let out = s;
  for (let i = 0; i < 12; i++) {
    const next = out
      .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "<strong>$1</strong>")
      .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, "<em>$1</em>")
      .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, "<u>$1</u>")
      .replace(/\[s\]([\s\S]*?)\[\/s\]/gi, "<s>$1</s>")
      .replace(/\[strike\]([\s\S]*?)\[\/strike\]/gi, "<s>$1</s>")
      .replace(/\[center\]([\s\S]*?)\[\/center\]/gi, '<div class="text-center">$1</div>')
      .replace(/\[left\]([\s\S]*?)\[\/left\]/gi, '<div class="text-left">$1</div>')
      .replace(/\[right\]([\s\S]*?)\[\/right\]/gi, '<div class="text-right">$1</div>')
      .replace(/\[quote(?:=[^\]]+)?\]([\s\S]*?)\[\/quote\]/gi, "<blockquote>$1</blockquote>")
      .replace(/\[spoiler(?:=([^\]]+))?\]([\s\S]*?)\[\/spoiler\]/gi, (_m, title, inner) => {
        const t = (title ? String(title) : "Spoiler").trim() || "Spoiler";
        return `<details><summary>${t}</summary>${inner}</details>`;
      })
      .replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, (_m, href, inner) => {
        const safe = safeHref(String(href));
        return safe ? `<a href="${safe}" target="_blank" rel="noreferrer">${inner}</a>` : String(inner);
      })
      .replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (_m, href) => {
        const safe = safeHref(String(href));
        return safe ? `<a href="${safe}" target="_blank" rel="noreferrer">${safe}</a>` : String(href);
      })
      .replace(/\[img\]([\s\S]*?)\[\/img\]/gi, (_m, src) => {
        const safe = safeHref(String(src));
        return safe ? `<img src="${safe}" alt="" />` : "";
      })
      .replace(/\[youtube\]([\s\S]*?)\[\/youtube\]/gi, (_m, id) => {
        const slug = String(id).trim().replace(/[^a-zA-Z0-9_-]/g, "");
        return slug
          ? `<a href="https://www.youtube.com/watch?v=${slug}" target="_blank" rel="noreferrer">YouTube ${slug}</a>`
          : "";
      })
      .replace(/\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/gi, (_m, color, inner) => {
        const c = safeColor(String(color));
        return c ? `<span style="color:${c}">${inner}</span>` : String(inner);
      })
      .replace(/\[size=([^\]]+)\]([\s\S]*?)\[\/size\]/gi, (_m, raw, inner: string) => {
        const n = Number.parseInt(String(raw), 10);
        const plain = inner.replace(/<[^>]+>/g, "").trim();
        if (n >= 4 && plain.length > 0 && plain.length < 80 && !inner.includes("<p")) {
          const level = n >= 6 ? 2 : n >= 5 ? 3 : 4;
          return `<h${level}>${inner}</h${level}>`;
        }
        const rem = SIZE_REM[Math.min(7, Math.max(1, Number.isFinite(n) ? n : 3))];
        return `<span style="font-size:${rem}">${inner}</span>`;
      })
      .replace(/\[font=[^\]]+\]([\s\S]*?)\[\/font\]/gi, "$1")
      .replace(/\[heading\]([\s\S]*?)\[\/heading\]/gi, "<h3>$1</h3>")
      .replace(/\[title\]([\s\S]*?)\[\/title\]/gi, "<h3>$1</h3>");
    if (next === out) break;
    out = next;
  }
  return out;
}

function autolink(s: string) {
  return s.replace(/(^|[\s>(])(https?:\/\/[^\s<]+)(?=$|[\s<])/g, (_m, pre, url) => {
    const safe = safeHref(url.replace(/[),.;]+$/, ""));
    if (!safe) return `${pre}${url}`;
    return `${pre}<a href="${safe}" target="_blank" rel="noreferrer">${escapeHtml(decodeAmp(url))}</a>`;
  });
}

function stripLeftoverBbcode(s: string) {
  return s.replace(/\[\/?(?:b|i|u|s|strike|size|color|font|url|img|list|quote|spoiler|center|left|right|code|line|hr|heading|title|youtube|\*)(?:=[^\]]*)?\]/gi, "");
}

function toParagraphs(s: string) {
  let html = s.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  html = html.replace(/\n/g, "<br/>");
  html = `<p>${html}</p>`;
  html = html.replace(/<p>((?:<br\s*\/?>|\s)*)<\/p>/gi, "");
  html = html.replace(/<p>((?:<br\s*\/?>|\s)*)(<(?:h[1-6]|ul|ol|blockquote|div|hr|details|pre|table))/gi, "$2");
  html = html.replace(/(<\/(?:h[1-6]|ul|ol|blockquote|div|details|pre|table)>|<hr\s*\/?>)(?:<br\s*\/?>|\s)*<\/p>/gi, "$1");
  html = html.replace(/(<(?:h[1-6]|ul|ol|blockquote|div|details|pre|table|hr)\b[^>]*>)/gi, "</p>$1");
  html = html.replace(/(<\/(?:h[1-6]|ul|ol|blockquote|div|details|pre|table)>|<hr\s*\/?>)/gi, "$1<p>");
  html = html.replace(/<p>((?:<br\s*\/?>|\s)*)<\/p>/gi, "");
  html = html.replace(/<p>((?:<br\s*\/?>|\s)*)/gi, "<p>");
  html = html.replace(/(<br\s*\/?>){3,}/gi, "<br/><br/>");
  return html;
}

const ALLOWED_TAGS = /^(p|br|div|span|strong|b|em|i|u|s|a|img|ul|ol|li|h[1-6]|blockquote|pre|code|hr|table|thead|tbody|tr|th|td|details|summary)$/i;

function sanitizeHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (full, tag: string, attrs = "") => {
      if (!ALLOWED_TAGS.test(tag)) return "";
      const close = full.startsWith("</");
      if (close) return `</${tag.toLowerCase()}>`;
      let kept = "";
      const href = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const src = attrs.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const style = attrs.match(/\bstyle\s*=\s*("([^"]*)"|'([^']*)')/i);
      if (href) {
        const safe = safeHref(href[2] || href[3] || href[4] || "");
        if (safe) kept += ` href="${safe}" target="_blank" rel="noreferrer"`;
      }
      if (src) {
        const safe = safeHref(src[2] || src[3] || src[4] || "");
        if (safe) kept += ` src="${safe}" alt=""`;
      }
      if (style) {
        const val = (style[2] || style[3] || "").replace(/expression|url\s*\(|javascript/gi, "");
        const color = val.match(/color\s*:\s*([^;]+)/i);
        const size = val.match(/font-size\s*:\s*([^;]+)/i);
        const bits = [
          color && safeColor(color[1].trim()) ? `color:${safeColor(color[1].trim())}` : "",
          size && /^(?:\d+(?:\.\d+)?(?:px|rem|em|%)|[\d.]+rem)$/i.test(size[1].trim()) ? `font-size:${size[1].trim()}` : "",
        ].filter(Boolean);
        if (bits.length) kept += ` style="${bits.join(";")}"`;
      }
      const name = tag.toLowerCase();
      if (name === "br") return "<br/>";
      if (name === "hr") return "<hr/>";
      if (name === "img") return kept.includes("src=") ? `<img${kept} />` : "";
      return `<${name}${kept}>`;
    });
}

export function markupToHtml(raw: string) {
  const src = (raw || "").trim();
  if (!src) return "";
  if (looksLikeHtml(src) && !/\[[a-z]{1,12}(?:=[^\]]*)?\]/i.test(src)) {
    return sanitizeHtml(src);
  }
  let s = escapeHtml(src);
  const codes: string[] = [];
  s = s.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, (_m, inner) => {
    codes.push(`<pre><code>${inner}</code></pre>`);
    return `\u0000CODE${codes.length - 1}\u0000`;
  });
  s = s.replace(/\[(?:line|hr)\]/gi, "<hr/>");
  s = convertLists(s);
  s = convertInline(s);
  s = autolink(s);
  s = stripLeftoverBbcode(s);
  s = toParagraphs(s);
  s = s.replace(/\u0000CODE(\d+)\u0000/g, (_m, i) => codes[Number(i)] || "");
  return s;
}

export function stripBbcode(s: string) {
  return s
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
