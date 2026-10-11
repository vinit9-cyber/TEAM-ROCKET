// Pune APMC daily prices with automatic fallback to the newest historical report
// that contains the requested commodity. This is a daily report feed, not tick data.
const CURRENT_URL = "https://apmcpune.in/bajarbhav/daily-public";
const LANDING_URL = "https://apmcpune.in/market-price/daily-market-price";
const BASE = "https://apmcpune.in";
const SOURCE_NAME = "Pune APMC — Daily Bajarbhav";

const COMMODITY_ALIASES = {
  tomato: ["tomato", "टोमॅटो", "टमाटर", "टमाटे"],
  onion: ["onion", "कांदा", "प्याज"],
  potato: ["potato", "बटाटा", "आलू", "बटाटे"],
  grapes: ["grape", "grapes", "द्राक्ष", "द्राक्षे"],
  pomegranate: ["pomegranate", "डाळिंब", "अनार"],
  soybean: ["soybean", "soyabean", "सोयाबीन", "सोयाबिन"]
};
const CATEGORY_CANDIDATES = {
  tomato: ["main-veg", "moshi-veg", "manjeri-veg", "pimpri-veg", "khadki-veg"],
  onion: ["main-kanda", "moshi-kanda", "manjeri-kanda"],
  potato: ["main-kanda", "moshi-kanda", "manjeri-kanda"],
  grapes: ["main-fruit", "moshi-fruit", "manjeri-fruit"],
  pomegranate: ["main-fruit", "moshi-fruit", "manjeri-fruit"],
  soybean: ["main-gul-bhusar", "main-dryfruit", "main-kanda", "main-veg"]
};

function decodeEntities(value) {
  const named = { "&nbsp;": " ", "&amp;": "&", "&quot;": '"', "&#39;": "'", "&lt;": "<", "&gt;": ">" };
  return String(value || "")
    .replace(/&nbsp;|&amp;|&quot;|&#39;|&lt;|&gt;/g, m => named[m])
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function plainText(html) {
  return decodeEntities(String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/td|\/th)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[\t\r ]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}
function numeric(value) {
  const n = Number(String(value || "").replace(/[₹,\s]/g, "").replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function dateFromPage(text) {
  const m = text.match(/(?:बाजारभाव|बाजार भाव)\s*[-–:]\s*\(([^)]+)\)/i);
  return m ? m[1].trim() : "";
}
function isoDateFromReadable(value) {
  const match = String(value || "").match(/(\d{1,2})\s+([^\s,.]+)\.?[,]?\s*(20\d{2})/);
  if (!match) return "";
  const day = match[1].padStart(2, "0");
  const monthToken = match[2].replace(/\.$/, "");
  const months = {
    "जाने": "01", "जानेवारी": "01", "फेब्रु": "02", "फेब्रुवारी": "02", "मार्च": "03",
    "एप्रिल": "04", "मे": "05", "जून": "06", "जुलै": "07", "ऑगस्ट": "08",
    "सप्टें": "09", "सप्टेंबर": "09", "ऑक्टो": "10", "ऑक्टोबर": "10",
    "नोव्हें": "11", "नोव्हेंबर": "11", "डिसें": "12", "डिसेंबर": "12"
  };
  const month = months[monthToken];
  return month ? `${match[3]}-${month}-${day}` : "";
}
function parseTableRows(html, reportDate, sourceUrl) {
  const out = [];
  const tables = html.match(/<table\b[\s\S]*?<\/table>/gi) || [];
  for (const table of tables) {
    const rows = table.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
    for (const row of rows) {
      const cells = [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => plainText(m[1]).replace(/\n/g, " ").trim());
      if (cells.length < 6 || /शेतमालाचे नाव|commodity/i.test(cells[0])) continue;
      const commodity = cells[0];
      const arrival = numeric(cells[2]);
      const min = numeric(cells[3]);
      const max = numeric(cells[4]);
      const average = numeric(cells[5]);
      if (!commodity || !(average > 0) || !(min > 0) || !(max > 0)) continue;
      out.push({ commodity, unit: cells[1] || "क्विंटल", arrival,
        min_price: min, max_price: max, modal_price: average,
        market: "Pune APMC", district: "Pune", arrival_date: reportDate,
        source: SOURCE_NAME, source_url: sourceUrl || CURRENT_URL });
    }
  }
  return out;
}
function parseCards(html, reportDate, sourceUrl) {
  const out = [];
  const lines = plainText(html).split("\n").map(s => s.trim()).filter(Boolean);
  let currentSection = "";
  for (let i = 0; i < lines.length; i++) {
    if (/बाजार|कांदा-बटाटा|पालेभाजी|फळे बाजार|फुलांचा बाजार/i.test(lines[i]) && !/बाजारभाव|आजचे बाजारभाव/i.test(lines[i])) currentSection = lines[i].replace(/^#+\s*/, "").trim();
    if (!/आवक\s*[:(]/i.test(lines[i])) continue;
    let commodity = (lines[i - 1] || "").replace(/^#+\s*/, "").trim();
    if (!commodity || /बाजार|बाजारभाव|मुख्य बाजार|उपबाजार|आवक|किमान|कमाल|सरासरी/.test(commodity)) continue;
    const block = lines.slice(i, i + 5).join(" ");
    const arrivalMatch = block.match(/आवक\s*\(?\s*([\d,.]+)\s*\)?/i);
    const minMatch = block.match(/किमान\s*\(?\s*([\d,.]+)\s*\)?/i);
    const maxMatch = block.match(/कमाल\s*\(?\s*([\d,.]+)\s*\)?/i);
    const avgMatch = block.match(/(?:सरासरी|सर्वसाधारण)\s*\(?\s*([\d,.]+)\s*\)?/i);
    const min = numeric(minMatch && minMatch[1]), max = numeric(maxMatch && maxMatch[1]), average = numeric(avgMatch && avgMatch[1]);
    if (!(average > 0) || !(min > 0) || !(max > 0)) continue;
    out.push({ commodity, section: currentSection, unit: "क्विंटल", arrival: numeric(arrivalMatch && arrivalMatch[1]),
      min_price: min, max_price: max, modal_price: average, market: "Pune APMC", district: "Pune",
      arrival_date: reportDate, source: SOURCE_NAME, source_url: sourceUrl || CURRENT_URL });
  }
  return out;
}
function uniqueRecords(records) {
  const seen = new Set();
  return records.filter(r => {
    const key = `${r.commodity.toLocaleLowerCase("mr-IN")}|${r.min_price}|${r.max_price}|${r.modal_price}|${r.arrival}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
function matchesCommodity(record, requested) {
  if (!requested) return true;
  const aliases = COMMODITY_ALIASES[requested.toLowerCase()] || [requested];
  const name = record.commodity.toLocaleLowerCase("mr-IN");
  return aliases.some(alias => name.includes(alias.toLocaleLowerCase("mr-IN")));
}
async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "FarmerMarketIntelligence/1.1 (daily market price display)", "Accept": "text/html" },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`Source returned ${response.status}`);
  return response.text();
}
function extractDatedReportLinks(html) {
  const links = new Map();
  for (const match of html.matchAll(/href\s*=\s*["']([^"']*\/bajarbhav\/view-daily-bajarbhav\/[^"']*\/(\d{4}-\d{2}-\d{2})[^"']*)["']/gi)) {
    try {
      const url = new URL(match[1], BASE);
      if (url.hostname !== "apmcpune.in") continue;
      links.set(match[2], url.href);
    } catch { /* ignore malformed links */ }
  }
  return [...links.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, url]) => ({ date, url }));
}
async function findLatestHistoricalRecord(requested, todayInPune) {
  const categories = CATEGORY_CANDIDATES[requested] || ["main-veg", "main-fruit", "main-kanda"];
  for (const slug of categories) {
    let listing;
    try { listing = await fetchHtml(`${BASE}/bajarbhav/daily-bajarbhav-dates/${slug}`); }
    catch { continue; }
    const reports = extractDatedReportLinks(listing).slice(0, 8);
    if (!reports.length) continue;
    // Fetch a small window in parallel, then choose the newest dated report containing this crop.
    const checked = await Promise.all(reports.map(async report => {
      try {
        const html = await fetchHtml(report.url);
        const text = plainText(html);
        const readableDate = dateFromPage(text) || report.date;
        const parsed = uniqueRecords([...parseTableRows(html, readableDate, report.url), ...parseCards(html, readableDate, report.url)]);
        const matching = parsed.filter(r => matchesCommodity(r, requested));
        return matching.length ? { report, readableDate, matching } : null;
      } catch { return null; }
    }));
    const latest = checked.filter(Boolean).sort((a, b) => b.report.date.localeCompare(a.report.date))[0];
    if (latest) {
      return { records: latest.matching, report_date: latest.report.date, report_date_label: latest.readableDate,
        source_url: latest.report.url, used_previous_report: latest.report.date < todayInPune, category: slug };
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "Method not allowed" }); }
  const requested = String((req.query || {}).commodity || "").trim().toLowerCase();
  if (requested && !Object.prototype.hasOwnProperty.call(COMMODITY_ALIASES, requested) && requested.length > 60) {
    return res.status(400).json({ error: "Unsupported commodity filter" });
  }
  const fetchedAt = new Date().toISOString();
  const todayInPune = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  let currentError = "";
  // First try the current published report. If it has no matching crop, look back through dated reports.
  try {
    const html = await fetchHtml(CURRENT_URL);
    const text = plainText(html);
    const readableDate = dateFromPage(text);
    const currentReportIso = isoDateFromReadable(readableDate);
    const parsed = uniqueRecords([...parseTableRows(html, readableDate, CURRENT_URL), ...parseCards(html, readableDate, CURRENT_URL)]);
    const records = parsed.filter(r => matchesCommodity(r, requested));
    if (records.length) {
      return res.status(200).json({ source: SOURCE_NAME, source_url: CURRENT_URL,
        data_frequency: "Daily market report; not tick-by-tick real-time", fetched_at: fetchedAt,
        report_date: currentReportIso || readableDate, report_date_label: readableDate,
        used_previous_report: Boolean(currentReportIso && currentReportIso < todayInPune),
        count: records.length, records });
    }
  } catch (error) { currentError = error.message || "Current report unavailable"; }

  if (requested) {
    const fallback = await findLatestHistoricalRecord(requested, todayInPune);
    if (fallback) {
      return res.status(200).json({ source: SOURCE_NAME, data_frequency: "Daily market report; not tick-by-tick real-time",
        fetched_at: fetchedAt, count: fallback.records.length, ...fallback,
        fallback_reason: currentError ? "Current report unavailable or did not contain this crop" : "No matching price in current report" });
    }
  }
  return res.status(200).json({ source: SOURCE_NAME, source_url: CURRENT_URL,
    data_frequency: "Daily market report; not tick-by-tick real-time", fetched_at: fetchedAt,
    report_date: "", used_previous_report: false, count: 0, records: [],
    message: "No matching price was found in the current or recent dated Pune APMC reports.",
    source_error: currentError || undefined });
}
