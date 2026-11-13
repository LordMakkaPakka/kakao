/**
 * Obsługa filmów wklejanych jako embed (film leży na zewnętrznym serwisie).
 *
 * Przyjmujemy:
 *  - sam adres strony filmu (YouTube, Vimeo, Dailymotion, Streamable, …),
 *  - adres osadzenia (`/embed/…`, `/e/…`),
 *  - cały kod `<iframe …></iframe>` skopiowany z serwisu.
 *
 * Wyciągamy z tego bezpieczny adres `https://…`, który można wstawić do
 * `<iframe>` na PolHubie. Adresy innych protokołów (javascript:, data:)
 * są odrzucane.
 */

export type EmbedResult =
  | { ok: true; url: string; provider: string; thumbnail: string | null }
  | { ok: false; error: string };

const IFRAME_SRC = /<iframe[^>]*\bsrc\s*=\s*["']([^"']+)["']/i;

/** Wyciąga identyfikator YouTube z różnych wariantów adresu. */
function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    return url.pathname.slice(1).split("/")[0] || null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") return url.searchParams.get("v");
    const shorts = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{6,})/);
    if (shorts) return shorts[1];
  }
  if (host === "youtube-nocookie.com") {
    const embed = url.pathname.match(/^\/embed\/([\w-]{6,})/);
    if (embed) return embed[1];
  }
  return null;
}

/** Zamienia adres serwisu na jego wersję do osadzenia. */
function toEmbedUrl(
  url: URL
): { url: string; provider: string; thumbnail?: string } | null {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  const yt = youtubeId(url);
  if (yt) {
    return {
      url: `https://www.youtube-nocookie.com/embed/${yt}`,
      provider: "YouTube",
      // Miniatura z YouTube — kafelek na stronie głównej nie jest wtedy pusty.
      thumbnail: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
    };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.match(/(\d{5,})/);
    if (id) {
      return { url: `https://player.vimeo.com/video/${id[1]}`, provider: "Vimeo" };
    }
  }

  if (host === "dailymotion.com" || host === "dai.ly") {
    const id = url.pathname.match(/([a-zA-Z0-9]{5,})/);
    if (id) {
      return {
        url: `https://www.dailymotion.com/embed/video/${id[1]}`,
        provider: "Dailymotion",
      };
    }
  }

  if (host === "streamable.com") {
    const id = url.pathname.match(/^\/(?:e\/)?([a-zA-Z0-9]+)/);
    if (id) {
      return { url: `https://streamable.com/e/${id[1]}`, provider: "Streamable" };
    }
  }

  // Adres już wygląda na gotowy do osadzenia (np. /embed/, /e/, /player/).
  if (/\/(?:embed|e|player|video)\//.test(url.pathname) || url.pathname.startsWith("/e/")) {
    return { url: url.toString(), provider: host };
  }

  return null;
}

/**
 * Przyjmuje to, co wkleił użytkownik, i zwraca adres do `<iframe>`.
 * Gdy nie da się rozpoznać serwisu, ale adres jest poprawnym `https://`,
 * zostawiamy go bez zmian — wiele serwisów samo obsługuje osadzanie.
 */
export function normalizeEmbed(input: string): EmbedResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Wklej adres filmu albo kod iframe." };
  if (raw.length > 2000) return { ok: false, error: "To za długi adres." };

  const fromIframe = raw.match(IFRAME_SRC)?.[1] ?? raw;
  // Wklejony sam adres bywa bez protokołu — dokładamy https.
  const candidate = /^https?:\/\//i.test(fromIframe)
    ? fromIframe
    : `https://${fromIframe.replace(/^\/\//, "")}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, error: "To nie wygląda na poprawny adres." };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Dozwolone są tylko adresy https." };
  }
  // Ujednolicamy do https — na stronie działającej po https mieszany
  // protokół zostałby zablokowany przez przeglądarkę.
  url.protocol = "https:";

  const embed = toEmbedUrl(url);
  if (embed) {
    return {
      ok: true,
      url: embed.url,
      provider: embed.provider,
      thumbnail: embed.thumbnail ?? null,
    };
  }

  // Ostatnia szansa: adres nieznanego serwisu — pozwalamy, ale tylko https.
  return {
    ok: true,
    url: url.toString(),
    provider: url.hostname.replace(/^www\./, ""),
    thumbnail: null,
  };
}
