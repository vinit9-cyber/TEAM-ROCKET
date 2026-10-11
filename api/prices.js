```javascript
const BASE = "https://apmcpune.in";
const CURRENT_URL = `${BASE}/bajarbhav/daily-public`;
const SOURCE = "Pune APMC — Daily Bajarbhav";

const ALIASES = {
  tomato: ["tomato", "टोमॅटो", "टमाटर", "टमाटे"],
  onion: ["onion", "कांदा", "प्याज"],
  potato: ["potato", "बटाटा", "आलू", "बटाटे"],
  grapes: ["grape", "grapes", "द्राक्ष", "द्राक्षे"],
  pomegranate: ["pomegranate", "डाळिंब", "अनार"],
  soybean: ["soybean", "soyabean", "सोयाबीन", "सोयाबिन"]
};

// Pune APMC market sections
const MARKETS = {
  "main-fruit": "Gultekdi — Fruits Market",
  "main-veg": "Gultekdi — Fruit & Vegetable Market",
  "main-kanda": "Gultekdi — Onion & Potato Market",
  "main-flower": "Gultekdi — Flower Market",
  "main-banana": "Gultekdi — Banana & Betel Leaf Market",
  "main-pale-bhaji": "Gultekdi — Leafy Vegetable Market",
  "main-gul-bhusar": "Gultekdi — Jaggery & Grocery Market",
  "main-dryfruit": "Gultekdi — Dry Fruits Market",
  "main-chinese": "Gultekdi — Chinese Market",

  "manjari-fruit": "Manjari — Fruits Market",
  "manjari-veg": "Manjari — Fruit & Vegetable Market",
  "manjari-onion": "Manjari — Onion & Potato Market",
  "manjari-pale-bhaji": "Manjari — Leafy Vegetable Market",
  "manjeri-fruit": "Manjari — Fruits Market",
  "manjeri-veg": "Manjari — Fruit & Vegetable Market",
  "manjeri-kanda": "Manjari — Onion & Potato Market",

  "moshi-fruit": "Moshi — Fruits Market",
  "moshi-veg": "Moshi — Fruit & Vegetable Market",
  "moshi-onion": "Moshi — Onion & Potato Market",
  "moshi-kanda": "Moshi — Onion & Potato Market",

  "pimpri-veg": "Pimpri — Fruit & Vegetable Market",
  "pimpri-flower": "Pimpri — Flower Market",
  "khadki-veg": "Khadki — Fruit & Vegetable Market",
  "uttamnagar-veg": "Uttamnagar — Vegetable Market"
};

const CATEGORIES = Object.keys(MARKETS);

function decode(s = "") {
  return String(s)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) =>
      String.fromCodePoint(+n)
    )
    .replace(/&#x([\da-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    );
}

function text(html = "") {
  return decode(
    String(html)
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(
        /<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/td|\/th)\b[^>]*>/gi,
        "\n"
      )
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t\r]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function num(value) {
  const n = Number(
    String(value || "")
      .replace(/[₹,\s]/g, "")
      .replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(n) ? n : 0;
}

async function get(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "FarmerMarketIntelligence/1.2",
      Accept: "text/html"
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`APMC returned ${response.status}`);
  }

  return response.text();
}

function reportLinks(html) {
  const found = new Map();

  const re =
    /href=["']([^"']*\/bajarbhav\/view-daily-bajarbhav\/[^"']*)["']/gi;

  for (const match of html.matchAll(re)) {
    try {
      const url = new URL(match[1], BASE);

      if (url.hostname !== "apmcpune.in") continue;

      const date = url.href.match(/(20\d{2}-\d{2}-\d{2})/);

      if (date) {
        found.set(date[1], url.href);
      }
    } catch {}
  }

  return [...found.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, url]) => ({ date, url }));
}

function parseReport(html, date, url, slug) {
  const records = [];
  const tables =
    html.match(/<table\b[\s\S]*?<\/table>/gi) || [];

  for (const table of tables) {
    const rows =
      table.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];

    for (const row of rows) {
      const cells = [...row.matchAll(
        /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi
      )].map(m =>
        text(m[1]).replace(/\n/g, " ").trim()
      );

      if (cells.length < 6) continue;

      if (/शेतमालाचे नाव|commodity/i.test(cells[0])) {
        continue;
      }

      const commodity = cells[0];
      const arrival = num(cells[2]);
      const min = num(cells[3]);
      const max = num(cells[4]);
      const average = num(cells[5]);

      if (
        !commodity ||
        min <= 0 ||
        max <= 0 ||
        average <= 0
      ) {
        continue;
      }

      records.push({
        commodity,
        unit: cells[1] || "क्विंटल",
        arrival,
        min_price: min,
        max_price: max,
        modal_price: average,
        market: MARKETS[slug] || slug,
        section: MARKETS[slug] || slug,
        district: "Pune",
        arrival_date: date,
        source: SOURCE,
        source_url: url
      });
    }
  }

  return records;
}

function matches(record, requested) {
  if (!requested) return true;

  const aliases = ALIASES[requested] || [requested];

  const name = record.commodity.toLocaleLowerCase("mr-IN");

  return aliases.some(alias =>
    name.includes(alias.toLocaleLowerCase("mr-IN"))
  );
}

function unique(records) {
  const seen = new Set();

  return records.filter(record => {
    const key = [
      record.market,
      record.commodity,
      record.arrival_date,
      record.min_price,
      record.max_price,
      record.modal_price
    ].join("|");

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

export default async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "s-maxage=300, stale-while-revalidate=600"
  );

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const requested = String(
    req.query?.commodity || ""
  )
    .trim()
    .toLowerCase();

  if (requested && requested.length > 60) {
    return res.status(400).json({
      error: "Invalid commodity filter"
    });
  }

  const fetchedAt = new Date().toISOString();

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  const results = await Promise.all(
    CATEGORIES.map(async slug => {
      try {
        const listing = await get(
          `${BASE}/bajarbhav/daily-bajarbhav-dates/${slug}`
        );

        // Scan up to 10 dated reports per market section.
        const reports = reportLinks(listing).slice(0, 10);
        const historicalRecords = [];

        for (const report of reports) {
          try {
            const reportHtml = await get(report.url);

            const parsed = unique(
              parseReport(
                reportHtml,
                report.date,
                report.url,
                slug
              )
            ).filter(record =>
              matches(record, requested)
            );

            historicalRecords.push(...parsed);
          } catch {
            // Continue if an individual report cannot be fetched.
          }
        }

        if (historicalRecords.length) {
          const latestDate = historicalRecords
            .map(r => r.arrival_date)
            .sort()
            .at(-1);

          return {
            report_date: latestDate,
            source_url: historicalRecords[0].source_url,
            records: historicalRecords
          };
        }
      } catch {
        // Continue if a market section cannot be fetched.
      }

      return null;
    })
  );

  const found = results.filter(Boolean);

  const records = unique(
    found.flatMap(item => item.records)
  ).sort((a, b) =>
    a.market.localeCompare(b.market)
  );

  const dates = found
    .map(item => item.report_date)
    .sort();

  const newestDate = dates[dates.length - 1] || "";

  return res.status(200).json({
    source: SOURCE,
    source_url: CURRENT_URL,
    data_frequency:
      "Daily market report; not live tick-by-tick prices",
    fetched_at: fetchedAt,
    report_date: newestDate,
    used_previous_report: Boolean(
      newestDate && newestDate < today
    ),
    count: records.length,
    markets: [
      ...new Set(records.map(r => r.market))
    ],
    records,
    message: records.length
      ? ""
      : "No matching prices were found in the scanned Pune APMC reports."
  });
}
```
