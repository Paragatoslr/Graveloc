export function formatDate(iso, lang) {
  if (!iso) return "—";
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === "fil" ? "fil-PH" : "en-PH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(iso, lang) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === "fil" ? "fil-PH" : "en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatWhen(iso, lang) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = new Intl.DateTimeFormat(lang === "fil" ? "fil-PH" : "en-PH", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  if (sameDay) return time;
  return formatDateTime(iso, lang);
}

export function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function greeting(lang, date = new Date()) {
  const hour = date.getHours();
  if (lang === "fil") {
    if (hour < 12) return "Magandang umaga";
    if (hour < 18) return "Magandang hapon";
    return "Magandang gabi";
  }
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}
