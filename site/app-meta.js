(function exposeAppMeta(root) {
  const version = "20260604-btc-weekly-risk";
  const appShell = [
    "./",
    "./index.html",
    `./app-meta.js?v=${version}`,
    `./styles.css?v=${version}`,
    `./script.js?v=${version}`,
    "./manifest.webmanifest",
    "./icons/icon.svg",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/icon-maskable-512.png",
    "./icons/apple-touch-icon.png",
    "./data/weekly_options.json",
    "./data/public_weekly_replay.json",
  ];

  const meta = Object.freeze({
    version,
    appShell: Object.freeze(appShell.slice()),
  });
  root.OneMonthFinderMeta = meta;
  if (root.document?.documentElement) {
    root.document.documentElement.dataset.appVersion = version;
  }
})(typeof self !== "undefined" ? self : window);
