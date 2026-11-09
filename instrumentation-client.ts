// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://74c6e839d8b71823f7d65ed1cca6b184@o4511702036905984.ingest.de.sentry.io/4511702078586960",

  // Performance: the Sentry client ships as a ~410 KiB chunk that is parsed on
  // EVERY page load, and tracesSampleRate: 1 additionally sent a transaction
  // for every single visit. 15% sampling still surfaces error-linked traces
  // while cutting Sentry ingest ~85%. Raise temporarily when hunting a
  // specific performance issue.
  tracesSampleRate: 0.15,
  // Logs are a debugging aid — dev only, so production clients skip the extra
  // instrumentation and payload.
  enableLogs: process.env.NODE_ENV !== "production",

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
