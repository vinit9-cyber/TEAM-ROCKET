# शेतकरी मित्र — Farmer Market Intelligence

A mobile-friendly, Marathi-first prototype for agricultural market intelligence for small-scale farmers in Maharashtra.

## Features

- Farmer-friendly Mukta/Hind typography with readable system-font fallbacks
- Farmer, crop-field and tractor photos bundled locally
- Marathi, Hindi and English interface
- Large pictorial crop selector and browser voice accessibility
- Pune APMC daily market prices fetched by a server-side Vercel function
- Displays the published minimum, maximum, average/modal price, arrival quantity and report date when provided by the source
- If the current report has no price for the selected crop, searches recent dated APMC reports and uses the newest report that contains that crop
- Clearly labels older prices as the latest available report and displays the report date
- Estimated net proceeds after the farmer-entered transport cost, where the source unit is per quintal
- No fabricated fallback prices: if the official source is unavailable or a crop is absent from the report, the UI says so
- Direct link to the official Pune APMC price page

## Important data freshness and scope

The source is Pune APMC's public daily price page and dated archive: <https://apmcpune.in/bajarbhav/daily-public> and <https://apmcpune.in/market-price/daily-market-price>.

**This is an official daily market report, not a tick-by-tick real-time trading feed.** The site reports daily commodity prices and arrivals; values may update when the APMC publishes its report. The API first checks the current report. If the selected crop is missing, it checks recent dated reports (up to eight report dates per relevant market category) and returns the newest report that actually contains that crop. The interface marks this as a previous/latest-available report and displays its publication date. It also shows the time this application fetched the page. A successful fetch does not mean the underlying report changed at that moment.

The current integration covers Pune APMC only. It does not invent prices for Nashik, Solapur, or other markets. Cross-market ranking is intentionally not claimed until verified official data feeds for additional markets and actual route costs are integrated.

The net-proceeds estimate is:

`estimated net = reported average price × quantity − farmer-entered transport cost per quintal × quantity`

This is only an estimate. It does not include verified road distances, market fees, loading/unloading, spoilage, vehicle capacity, or other charges. The prototype's price-outlook section is still illustrative and must not be treated as a forecast derived from historical market data.

## Local setup

Requirements: Node.js 18+.

1. Install the [Vercel CLI](https://vercel.com/docs/cli):

   ```bash
   npm install -g vercel
   ```

2. From the project directory run:

   ```bash
   vercel dev
   ```

3. Open the local URL shown by Vercel. The `/api/prices` function fetches the APMC page server-side, so no API key is required for this source.

The official website may change its HTML structure or temporarily block automated requests. If parsing fails, the site displays an unavailable message instead of making up prices. Review `api/prices.js` if the source page structure changes.

## Publish to GitHub

1. Create a public repository on GitHub.
2. Upload the files in this project or push them with Git.
3. Keep `.env`, credentials, tokens, and private data out of the repository. No environment variable is required for the current APMC integration.

## Deploy on Vercel

1. Sign in to Vercel and choose **Add New → Project**.
2. Import the GitHub repository.
3. Deploy. No API key or environment variable is needed for the current public APMC page integration.
4. Test `/api/prices?commodity=tomato` on the deployed domain. A successful response includes `source`, `source_url`, `data_frequency`, `fetched_at`, `report_date`, `used_previous_report`, and `records`. If today's crop price is missing, the API searches recent dated APMC reports and returns the newest available price with its report date.
5. If the source is unavailable, check the function logs and compare the official page: <https://apmcpune.in/bajarbhav/daily-public>.

## Supported crop filters

- Tomato (`tomato`)
- Onion (`onion`)
- Potato (`potato`)
- Grapes (`grapes`)
- Pomegranate (`pomegranate`)
- Soybean (`soybean`)

The source may not report every crop on every day. The API searches recent dated reports before returning an empty result. If no recent report contains the crop, the prototype says so instead of replacing it with demo prices.

## Source

- [Pune APMC — Daily Bajarbhav](https://apmcpune.in/bajarbhav/daily-public)
- [Pune APMC — Daily market price page](https://apmcpune.in/market-price/daily-market-price)
- [Pune APMC Statistics Department](https://apmcpune.in/en/about-us-en/departments-en/department-of-statistics-en)

## Next steps before real-world use

- Confirm the upstream page structure remains stable and add an automated live integration test
- Add additional official market sources before presenting cross-market rankings
- Integrate validated route distances, vehicle capacity, market fees, loading/unloading and spoilage costs
- Store historical official reports and validate any price forecasting model
- Add monitoring for stale reports and source outages
