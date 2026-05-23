#!/usr/bin/env node

require('ts-node/register');

const { ConfigService } = require('@nestjs/config');
const {
  AirbnbBrowserScraperService,
} = require('../src/airbnb/airbnb-browser-scraper.service');

const defaultListingIds = [
  '1315879732817724596',
  '1500203670194172028',
  '45516670',
  '1330381537006808505',
];

function dateAfter(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const args = {
    listingIds: [],
    hostId: null,
    checkIn: dateAfter(21),
    checkOut: dateAfter(23),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--host' && argv[i + 1]) {
      args.hostId = argv[i + 1];
      i += 1;
    } else if (arg === '--check-in' && argv[i + 1]) {
      args.checkIn = argv[i + 1];
      i += 1;
    } else if (arg === '--check-out' && argv[i + 1]) {
      args.checkOut = argv[i + 1];
      i += 1;
    } else if (/^\d{6,}$/.test(arg)) {
      args.listingIds.push(arg);
    }
  }

  if (args.listingIds.length === 0) args.listingIds = defaultListingIds;
  return args;
}

async function timed(label, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    return { label, ok: true, ms: Date.now() - start, result };
  } catch (error) {
    return {
      label,
      ok: false,
      ms: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = new ConfigService({
    ...process.env,
    AIRBNB_HEADLESS_TIMEOUT_MS: process.env.AIRBNB_HEADLESS_TIMEOUT_MS || '45000',
  });
  const scraper = new AirbnbBrowserScraperService(config);

  const listingChecks = [];
  for (const listingId of args.listingIds) {
    listingChecks.push(await timed(`listing:${listingId}`, () =>
      scraper.scrapeListing(listingId, {
        checkIn: args.checkIn,
        checkOut: args.checkOut,
      }),
    ));
  }

  const firstHostId =
    args.hostId ||
    listingChecks
      .map((check) => check.result?.hostId)
      .find(Boolean) ||
    null;

  const hostCheck = firstHostId
    ? await timed(`host:${firstHostId}`, () => scraper.scrapeHostListings(firstHostId))
    : null;

  const report = {
    checkIn: args.checkIn,
    checkOut: args.checkOut,
    listings: listingChecks.map((check) => ({
      label: check.label,
      ok: check.ok,
      ms: check.ms,
      error: check.error,
      roomId: check.result?.roomId ?? null,
      finalUrl: check.result?.finalUrl ?? null,
      hostId: check.result?.hostId ?? null,
      title: check.result?.title ?? null,
      priceTotal: check.result?.priceTotal ?? null,
      priceText: check.result?.priceText ?? null,
      captchaDetected: check.result?.captchaDetected ?? null,
      linkedListings: check.result?.listingIds?.slice(0, 10) ?? [],
    })),
    host: hostCheck
      ? {
          label: hostCheck.label,
          ok: hostCheck.ok,
          ms: hostCheck.ms,
          error: hostCheck.error,
          count: Array.isArray(hostCheck.result) ? hostCheck.result.length : 0,
          listings: Array.isArray(hostCheck.result)
            ? hostCheck.result.slice(0, 20)
            : [],
        }
      : null,
  };

  console.log(JSON.stringify(report, null, 2));

  const successfulListingCount = report.listings.filter(
    (listing) => listing.hostId || listing.priceTotal || listing.title,
  ).length;
  if (successfulListingCount === 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
