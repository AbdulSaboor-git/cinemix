// app/api/kinodivbox/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 6000;

/**
 * Fallback HTML mirroring https://kinodivbox.github.io/iframe (<main class="embed">,
 * <nav id="playerSwitcher" class="switcher">, <section id="stage" class="stage">)
 * without any iframe sandbox attributes so all players and download options work.
 */
function buildFallbackKdbHtml(): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>KinoDivBox Player</title>
</head>
<body>
  <main class="embed" aria-label="KinoDivBox встроенный видеоплеер">
    <nav id="playerSwitcher" class="switcher" aria-label="Выбор источника видео"></nav>
    <section id="stage" class="stage" aria-live="polite"></section>
  </main>
  <script src="https://super-puper.che-bur-net.cc/vv2.js"></script>
  <script src="https://allohatv.github.io/insert-player.js"></script>
  <script src="https://kodir2.github.io/actualize.js" async></script>
  <script src="https://hdvb-player.github.io/actualize.js" async></script>
  <script src="https://lmx-pl.github.io/lmx-f.github.io/act.js" async></script>
  <script>!function(e,n,t,r,a){r=e.createElement(n),a=e.getElementsByTagName(n)[0],r.async=!0,r.src=t,a.parentNode.insertBefore(r,a)}(document,"script","https://kodik-add.com/change-domains.min.js");</script>
  <script>
    const players = [
      { key: "alloha", label: "Alloha", fn: id => \`https://harald-as.newplayjj.com/?kp=\${id}&token=e7b61f192ac4bf6726a9dd6a1470402b\` },
      { key: "collaps", label: "Collaps", fn: id => \`https://api.namy.ws/embed/kp/\${id}\` },
      {
        key: "hdvb",
        label: "HDVB",
        fn: async id => {
          try {
            const token = "8a22f8e7684404c3815e3ffa940f00a0";
            const url = \`https://apivb.com/api/videos.json?id_kp=\${id}&token=\${token}\`;
            const res = await fetch(url);
            if (!res.ok) return null;
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0 && data[0].iframe_url) return data[0].iframe_url;
          } catch (e) {}
          return null;
        }
      },
      { key: "veoveo", label: "VeoVeo", fn: id => \`https://api.rstprgapipt.com/balancer-api/iframe?kp=\${id}&token=eyJhbGciOiJIUzI1NiJ9.eyJ3ZWJTaXRlSWQiOiI4MTUiLCJpc3MiOiJhcGktd2VibWFzdGVyIiwic3ViIjoiODAzIiwiaWF0IjoxNzc4MjYxMTE3LCJqdGkiOiIzZDkwOTk2OS05M2E4LTQwMDQtYTM0Mi0yYTQ2YzEyNTIyNzUiLCJzY29wZSI6IkRMRSJ9.w9ElOww-i07LD5tX05TGYzgiViDqh8saEWmOwLAzyGU\` },
      { key: "videoseed", label: "VideoSeeD", fn: id => \`https://tv-2-kinoserial.net/embed_auto/\${id}/?token=6091e1d0bf421f73804d2f0dcc2bf1cf\` },
      { key: "kodik", label: "Kodik", fn: id => \`https://kodikplayer.com/find-player?kinopoiskID=\${id}\` },
      { key: "trailer", label: "Трейлер", fn: id => \`https://api.atomics.ws/embed/trailer-kp/\${id}\` }
    ];

    function showPlayer(src, label) {
      const stage = document.getElementById("stage");
      const iframe = document.createElement("iframe");
      iframe.className = "video-frame";
      iframe.src = src;
      iframe.loading = "eager";
      iframe.title = \`Видеоплеер \${label}\`;
      iframe.allowFullscreen = true;
      iframe.setAttribute("allow", "autoplay; fullscreen; picture-in-picture; encrypted-media");
      iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      stage.innerHTML = "";
      stage.appendChild(iframe);
    }

    async function buildPlayers(id) {
      const switcher = document.getElementById("playerSwitcher");
      switcher.innerHTML = "";
      let firstBtn = null;
      for (const item of players) {
        try {
          const src = await item.fn(id);
          if (!src) continue;
          const btn = document.createElement("button");
          btn.className = "switch-btn";
          btn.type = "button";
          btn.textContent = item.label;
          btn.setAttribute("data-player", item.key);
          btn.setAttribute("aria-pressed", "false");
          btn.addEventListener("click", () => {
            [...switcher.children].forEach(b => {
              b.classList.remove("active");
              b.setAttribute("aria-pressed", "false");
            });
            btn.classList.add("active");
            btn.setAttribute("aria-pressed", "true");
            showPlayer(src, item.label);
          });
          switcher.appendChild(btn);
          if (!firstBtn) {
            firstBtn = btn;
            firstBtn.click();
          }
        } catch (e) {}
      }
    }

    (function () {
      const params = new URLSearchParams(location.search);
      const id = params.get("id");
      if (id) buildPlayers(id);
    })();
  </script>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get("id") || "").trim();
  if (!id || !/^\d+$/.test(id)) {
    return new NextResponse("Invalid film ID", { status: 400 });
  }

  const upstreamUrl = `https://kinodivbox.github.io/iframe?id=${encodeURIComponent(id)}`;

  let html = "";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const res = await fetch(upstreamUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: "https://kinodivbox.github.io/",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      html = await res.text();
    } else {
      html = buildFallbackKdbHtml();
    }
  } catch {
    clearTimeout(timeoutId);
    html = buildFallbackKdbHtml();
  }

  // Strip any hardcoded sandbox attributes or setAttribute("sandbox", ...) calls in KinoDivBox's
  // /iframe HTML so embedded players (HDVB, VideoSeeD, Alloha, Collaps, etc.) are never sandboxed
  // and can show their native download buttons and play freely just like on kinodivbox.github.io.
  html = html.replace(/\s+sandbox=(["'])[^"']*\1/gi, "");
  html = html.replace(
    /\.setAttribute\(\s*(['"])sandbox\1\s*,[^)]+\)/gi,
    '.removeAttribute("sandbox")',
  );

  const bridgeScript = `
<base href="https://kinodivbox.github.io/iframe">
<style id="cinemix-kdb-style">
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    height: 100% !important;
    overflow: hidden !important;
    background: #141212 !important;
  }
  main.embed, .embed {
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    height: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #141212 !important;
  }
  /* Hide the original top server switcher bar offscreen while keeping its buttons clickable in DOM */
  #playerSwitcher,
  nav.switcher,
  .switcher,
  .player-switch {
    position: fixed !important;
    top: -9999px !important;
    left: -9999px !important;
    width: 0 !important;
    height: 0 !important;
    min-height: 0 !important;
    max-height: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    border: 0 !important;
    opacity: 0 !important;
    pointer-events: none !important;
    overflow: hidden !important;
    z-index: -1 !important;
  }
  /* Hide ONLY the bottom credit line (<footer class="foot"> with "Готово · ID ..." & "KinoDivBox") and counter */
  footer.foot,
  .foot,
  #footStatus,
  .foot-status,
  .brand-link,
  body > center {
    display: none !important;
    height: 0 !important;
    min-height: 0 !important;
    max-height: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    border: 0 !important;
    overflow: hidden !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
  /* Let #stage (.stage) and .video-frame fill 100% of the iframe */
  #stage,
  section.stage,
  .stage {
    position: relative !important;
    flex: 1 1 auto !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #141212 !important;
  }
  iframe.video-frame,
  #stage > iframe {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    border: 0 !important;
    display: block !important;
  }
</style>
<script>
(function () {
  // 1. Prevent cross-origin ServiceWorker registration errors on proxied origin
  if (typeof navigator !== "undefined" && navigator.serviceWorker) {
    try {
      navigator.serviceWorker.register = function () {
        return Promise.resolve({});
      };
    } catch (e) {}
  }

  // 2. Intercept setAttribute("sandbox", ...) on iframes so KinoDivBox's /iframe script
  // never sandboxes the inner video player (enables native download options & full playback).
  var origSetAttribute = Element.prototype.setAttribute;
  if (origSetAttribute) {
    Element.prototype.setAttribute = function (name, value) {
      if (
        String(name).toLowerCase() === "sandbox" &&
        this &&
        this.tagName === "IFRAME"
      ) {
        try {
          this.removeAttribute("sandbox");
        } catch (e) {}
        return;
      }
      return origSetAttribute.call(this, name, value);
    };
  }

  // 3. Cap slow third-party balancer checks (such as apivb.com for HDVB) at 3s
  if (typeof window !== "undefined" && typeof window.fetch === "function") {
    var origFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var urlStr = typeof input === "string" ? input : (input && input.url) || "";
      if (urlStr.indexOf("apivb.com") !== -1 && typeof AbortController !== "undefined") {
        var ctrl = new AbortController();
        var timer = setTimeout(function () {
          ctrl.abort();
        }, 3000);
        var merged = Object.assign({}, init || {}, { signal: ctrl.signal });
        return origFetch(input, merged).finally(function () {
          clearTimeout(timer);
        });
      }
      return origFetch(input, init);
    };
  }

  var LAST_SIGNATURE = "";
  var IS_SYNCING = false;
  var SYNC_TIMER = null;
  var PENDING_SELECT = null;
  var OBSERVED_SWITCHER = null;

  function unsandboxVideoFrames() {
    var frames = document.querySelectorAll("iframe");
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      if (f.hasAttribute("sandbox")) {
        try {
          f.removeAttribute("sandbox");
          // Reload src if it was already mounted with a restrictive sandbox
          var currentSrc = f.getAttribute("src");
          if (currentSrc && !f.getAttribute("data-cinemix-unsandboxed")) {
            f.setAttribute("data-cinemix-unsandboxed", "1");
            f.src = currentSrc;
          }
        } catch (e) {}
      }
    }
  }

  function normalizeServerId(raw) {
    var s = String(raw || "").trim().toLowerCase();
    if (s === "трейлер" || s === "trailer") return "trailer";
    return s.replace(/[^a-z0-9а-яё]+/gi, "-");
  }

  function getButtonServerId(btn) {
    if (!btn) return "";
    var dp = btn.getAttribute("data-player");
    if (dp) return normalizeServerId(dp);
    return normalizeServerId(btn.textContent || "");
  }

  function isButtonActive(el) {
    if (!el) return false;
    if (
      el.getAttribute("aria-pressed") === "true" ||
      el.getAttribute("aria-selected") === "true" ||
      el.getAttribute("data-active") === "true"
    ) {
      return true;
    }
    var cls = el.className && typeof el.className === "string" ? el.className : "";
    return /\b(active|selected|current|is-active|act)\b/i.test(cls);
  }

  function getSwitcherButtons() {
    var switcher =
      document.getElementById("playerSwitcher") ||
      document.querySelector("nav.switcher, .switcher, .player-switch");
    if (!switcher) return [];
    return Array.from(
      switcher.querySelectorAll("button.switch-btn, button, [role='tab']")
    ).filter(function (btn) {
      return Boolean((btn.textContent || "").trim() || btn.getAttribute("data-player"));
    });
  }

  function triggerNativeButton(btn) {
    if (!btn) return false;
    // Ensure button is enabled before triggering click (KinoDivBox temporarily sets disabled during transitions)
    if (btn.disabled) {
      btn.disabled = false;
      btn.removeAttribute("disabled");
    }
    if (typeof btn.click === "function") {
      try {
        btn.click();
        return true;
      } catch (e) {}
    }
    try {
      btn.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        })
      );
      return true;
    } catch (e) {}
    return false;
  }

  function findMatchingButton(btns, req) {
    if (!btns.length || !req) return null;
    var targetId = req.id ? normalizeServerId(req.id) : "";
    var targetName = req.name ? normalizeServerId(req.name) : "";

    // 1. Match by data-player attribute or button text
    for (var i = 0; i < btns.length; i++) {
      var btnId = getButtonServerId(btns[i]);
      var txtId = normalizeServerId(btns[i].textContent || "");
      if (
        (targetId && (btnId === targetId || txtId === targetId)) ||
        (targetName && (btnId === targetName || txtId === targetName))
      ) {
        return btns[i];
      }
    }

    // 2. Fallback to index
    if (typeof req.index === "number" && btns[req.index]) {
      return btns[req.index];
    }
    return null;
  }

  function syncServers(force) {
    if (IS_SYNCING) return;
    IS_SYNCING = true;
    try {
      unsandboxVideoFrames();
      var btns = getSwitcherButtons();
      if (!btns.length) return;

      // Apply queued server selection once buttons are ready and not disabled
      if (PENDING_SELECT) {
        var pendingBtn = findMatchingButton(btns, PENDING_SELECT);
        if (pendingBtn && !pendingBtn.disabled) {
          PENDING_SELECT = null;
          if (!isButtonActive(pendingBtn)) {
            triggerNativeButton(pendingBtn);
          }
        }
      }

      var hasActive = false;
      var servers = btns.map(function (btn, idx) {
        var rawName = (btn.textContent || "").trim() || btn.getAttribute("data-player") || ("Server " + (idx + 1));
        var idSlug = getButtonServerId(btn) || ("server-" + idx);
        var isTrailer = idSlug === "trailer" || /^(трейлер|trailer)$/i.test(rawName);
        var active = isButtonActive(btn);
        if (active) hasActive = true;
        return {
          index: idx,
          id: isTrailer ? "trailer" : idSlug,
          name: isTrailer ? "Trailer" : rawName,
          rawName: rawName,
          isTrailer: isTrailer,
          active: active,
        };
      });

      if (!hasActive && servers.length > 0) {
        servers[0].active = true;
      }

      var sig = JSON.stringify(servers);
      if (!force && sig === LAST_SIGNATURE) return;
      LAST_SIGNATURE = sig;

      window.parent.postMessage(
        {
          type: "CINEMIX_KDB_SERVERS",
          filmId: ${JSON.stringify(id)},
          servers: servers,
        },
        "*"
      );
    } finally {
      IS_SYNCING = false;
    }
  }

  function scheduleSync(force) {
    if (SYNC_TIMER) clearTimeout(SYNC_TIMER);
    SYNC_TIMER = setTimeout(function () {
      SYNC_TIMER = null;
      syncServers(Boolean(force));
    }, 50);
  }

  function selectServerButton(req) {
    var btns = getSwitcherButtons();
    var target = findMatchingButton(btns, req);
    if (!target) {
      PENDING_SELECT = req;
      return;
    }
    if (target.disabled) {
      // Keep queued in case KinoDivBox is still in initial prepare state, and also trigger now
      PENDING_SELECT = req;
    } else {
      PENDING_SELECT = null;
    }
    triggerNativeButton(target);
    unsandboxVideoFrames();
    syncServers(true);
    setTimeout(function () {
      unsandboxVideoFrames();
      syncServers(true);
    }, 120);
  }

  window.addEventListener("message", function (e) {
    if (!e.data || typeof e.data !== "object") return;
    if (e.data.type === "CINEMIX_KDB_SELECT") {
      selectServerButton({
        index: typeof e.data.index === "number" ? e.data.index : Number(e.data.index),
        id: e.data.id || "",
        name: e.data.name || "",
      });
    } else if (e.data.type === "CINEMIX_KDB_PING") {
      syncServers(true);
    }
  });

  function attachSwitcherObserver() {
    var switcher =
      document.getElementById("playerSwitcher") ||
      document.querySelector("nav.switcher, .switcher, .player-switch");
    if (switcher && switcher !== OBSERVED_SWITCHER) {
      OBSERVED_SWITCHER = switcher;
      var swObserver = new MutationObserver(function () {
        scheduleSync(false);
      });
      swObserver.observe(switcher, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-pressed", "class", "disabled", "hidden"],
      });
    }
  }

  function initBridge() {
    unsandboxVideoFrames();
    attachSwitcherObserver();
    syncServers(true);

    var bodyObserver = new MutationObserver(function () {
      unsandboxVideoFrames();
      attachSwitcherObserver();
      scheduleSync(false);
    });
    if (document.documentElement) {
      bodyObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    setInterval(function () {
      unsandboxVideoFrames();
      attachSwitcherObserver();
      syncServers(false);
    }, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBridge);
  } else {
    initBridge();
  }
})();
</script>`;

  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (match) => `${match}${bridgeScript}`);
  } else {
    html = `${bridgeScript}${html}`;
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}