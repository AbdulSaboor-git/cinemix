// app/api/kinodivbox/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 5000;

/**
 * Fallback HTML mirroring https://kinodivbox.github.io/iframe so that even if
 * the server-side fetch to GitHub Pages times out or is blocked, the iframe
 * still renders with the original switcher hidden and custom button remapping active.
 */
function buildFallbackKdbHtml(): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>KinoDivBox Player</title>
  <script src="https://super-puper.che-bur-net.cc/vv2.js" async></script>
  <script src="https://allohatv.github.io/insert-player.js" async></script>
  <script src="https://kodir2.github.io/actualize.js" async></script>
  <script src="https://hdvb-player.github.io/actualize.js" async></script>
  <script src="https://lmx-pl.github.io/lmx-f.github.io/act.js" async></script>
  <script>!function(e,n,t,r,a){r=e.createElement(n),a=e.getElementsByTagName(n)[0],r.async=!0,r.src=t,a.parentNode.insertBefore(r,a)}(document,"script","https://kodik-add.com/change-domains.min.js");</script>
</head>
<body>
  <div class="wrap">
    <section class="player-wrap" aria-live="polite">
      <div class="player-switch" role="tablist" aria-label="Выбор плеера" id="playerSwitcher"></div>
      <div id="playerFrame" class="player-frame"></div>
    </section>
  </div>
  <script>
    const players = {
      "Alloha": id => \`https://harald-as.newplayjj.com/?kp=\${id}&token=e7b61f129f4a392ac4bf6726a9dd6a\`,
      "Collaps": id => \`https://api.namy.ws/embed/kp/\${id}\`,
      "HDVB": async id => {
        try {
          const token = "8a22f8e7684404c3815e3ffa940f00a0";
          const url = \`https://apivb.com/api/videos.json?id_kp=\${id}&token=\${token}\`;
          const res = await fetch(url);
          if (!res.ok) return null;
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && data[0].iframe_url) return data[0].iframe_url;
        } catch (e) {}
        return null;
      },
      "VeoVeo": id => \`https://api.rstprgapipt.com/balancer-api/iframe?kp=\${id}&token=eyJhbGciOiJIUzI1NiJ9.eyJ3ZWJTaXRlSWQiOiI4MTUiLCJpc3MiOiJhcGktd2VibWFzdGVyIiwic3ViIjoiODAzIiwiaWF0IjoxNzc4MjYxMTE3LCJqdGkiOiIzZDkwOTk2OS05M2E4LTQwMDQtYTM0Mi0yYTQ2YzEyNTIyNzUiLCJzY29wZSI6IkRMRSJ9.w9ElOww-i07LD5tX05TGYzgiViDqh8saEWmOwLAzyGU\`,
      "VideoSeeD": id => \`https://tv-2-kinoserial.net/embed_auto/\${id}/?token=6091e1d0bf421f73804d2f0dcc2bf1cf\`,
      "Kodik": id => \`https://kodikplayer.com/find-player?kinopoiskID=\${id}\`,
      "Трейлер": id => \`https://api.atomics.ws/embed/trailer-kp/\${id}\`
    };

    function showPlayer(src, name) {
      const frame = document.getElementById("playerFrame");
      const iframe = document.createElement("iframe");
      iframe.src = src;
      iframe.loading = "lazy";
      iframe.title = name;
      iframe.allowFullscreen = true;
      iframe.setAttribute("allow", "autoplay; fullscreen; picture-in-picture");
      frame.innerHTML = "";
      frame.appendChild(iframe);
    }

    async function buildPlayers(id) {
      const switcher = document.getElementById("playerSwitcher");
      const frame = document.getElementById("playerFrame");
      switcher.innerHTML = "";
      frame.innerHTML = "<div>Загрузка...</div>";
      let created = 0;
      for (const [name, fn] of Object.entries(players)) {
        try {
          const src = typeof fn === "function" ? await fn(id) : null;
          if (!src) continue;
          const btn = document.createElement("button");
          btn.className = "switch-btn";
          btn.type = "button";
          btn.textContent = name;
          btn.setAttribute("role", "tab");
          btn.setAttribute("aria-pressed", "false");
          btn.addEventListener("click", () => {
            [...switcher.children].forEach(b => b.setAttribute("aria-pressed", "false"));
            btn.setAttribute("aria-pressed", "true");
            showPlayer(src, name);
          });
          switcher.appendChild(btn);
          created++;
        } catch (e) {}
      }
      if (created === 0) {
        frame.innerHTML = "❌ Плееры не найдены";
        return;
      }
      switcher.querySelector("button")?.click();
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

  const bridgeScript = `
<base href="https://kinodivbox.github.io/iframe">
<style id="cinemix-kdb-style">
  html, body, .wrap, .player-wrap {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    height: 100% !important;
    max-width: 100% !important;
    overflow: hidden !important;
    background: #1e1918 !important;
  }
  /* Visually hide the original KinoDivBox server switcher bar while keeping its buttons clickable in DOM */
  #playerSwitcher,
  .player-switch,
  #players,
  .cinemix-kdb-hidden-bar {
    position: fixed !important;
    top: -9999px !important;
    left: -9999px !important;
    width: 0 !important;
    height: 0 !important;
    min-height: 0 !important;
    max-height: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    opacity: 0 !important;
    pointer-events: none !important;
    overflow: hidden !important;
    z-index: -1 !important;
  }
  /* Expand the player stage to fill 100% of the iframe */
  #playerFrame,
  .player-frame,
  #player {
    width: 100vw !important;
    height: 100vh !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    border-radius: 0 !important;
    display: block !important;
    background: #1e1918 !important;
  }
  #playerFrame > iframe,
  .player-frame > iframe,
  #player > iframe {
    width: 100% !important;
    height: 100% !important;
    border: 0 !important;
    display: block !important;
  }
</style>
<script>
(function () {
  // Prevent cross-origin ServiceWorker registration errors on proxied origin
  if (typeof navigator !== "undefined" && navigator.serviceWorker) {
    try {
      navigator.serviceWorker.register = function () {
        return Promise.resolve({});
      };
    } catch (e) {}
  }

  // Cap slow third-party balancer checks (such as apivb.com for HDVB) at 2.5s
  // so KinoDivBox's async buildPlayers(id) loop never stalls before creating
  // VeoVeo, VideoSeeD, Kodik, and Трейлер buttons or auto-clicking the first server.
  if (typeof window !== "undefined" && typeof window.fetch === "function") {
    var origFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var urlStr = typeof input === "string" ? input : (input && input.url) || "";
      if (urlStr.indexOf("apivb.com") !== -1 && typeof AbortController !== "undefined") {
        var ctrl = new AbortController();
        var timer = setTimeout(function () {
          ctrl.abort();
        }, 2500);
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

  function normalizeServerId(raw) {
    var s = String(raw || "").trim().toLowerCase();
    if (s === "трейлер" || s === "trailer") return "trailer";
    return s.replace(/[^a-z0-9а-яё]+/gi, "-");
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
      document.querySelector(".player-switch, #players");
    if (!switcher) return [];
    return Array.from(
      switcher.querySelectorAll("button, .switch-btn, .btn-player, [role='tab']")
    ).filter(function (btn) {
      return Boolean((btn.textContent || "").trim());
    });
  }

  function triggerNativeButton(btn) {
    if (!btn) return false;
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

    // 1. Match by server ID or button text (Alloha, Collaps, HDVB, VeoVeo, VideoSeeD, Kodik, Трейлер)
    for (var i = 0; i < btns.length; i++) {
      var btnId = normalizeServerId(btns[i].textContent || "");
      if ((targetId && btnId === targetId) || (targetName && btnId === targetName)) {
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
      var btns = getSwitcherButtons();
      if (!btns.length) return;

      // If the user clicked a custom button while buildPlayers(id) was still initializing,
      // apply that selection as soon as the button appears in #playerSwitcher.
      if (PENDING_SELECT) {
        var pendingBtn = findMatchingButton(btns, PENDING_SELECT);
        if (pendingBtn) {
          PENDING_SELECT = null;
          triggerNativeButton(pendingBtn);
        }
      }

      // If buildPlayers is still partway through and hasn't auto-clicked the first button yet,
      // auto-click the first button immediately so the user doesn't wait for slow balancers.
      var frame = document.getElementById("playerFrame") || document.getElementById("player");
      var hasIframe = frame && frame.querySelector("iframe");
      var anyActive = btns.some(isButtonActive);
      if (!hasIframe && !anyActive && btns[0]) {
        triggerNativeButton(btns[0]);
      }

      var hasActive = false;
      var servers = btns.map(function (btn, idx) {
        var rawName = (btn.textContent || "").trim();
        var idSlug = normalizeServerId(rawName);
        var isTrailer = idSlug === "trailer";
        var active = isButtonActive(btn);
        if (active) hasActive = true;
        return {
          index: idx,
          id: idSlug,
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
    }, 60);
  }

  function selectServerButton(req) {
    var btns = getSwitcherButtons();
    var target = findMatchingButton(btns, req);
    if (!target) {
      // Queue selection in case buildPlayers(id) hasn't appended this button yet
      PENDING_SELECT = req;
      return;
    }
    PENDING_SELECT = null;
    triggerNativeButton(target);
    syncServers(true);
    setTimeout(function () {
      syncServers(true);
    }, 100);
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
      document.querySelector(".player-switch, #players");
    if (switcher && switcher !== OBSERVED_SWITCHER) {
      OBSERVED_SWITCHER = switcher;
      var swObserver = new MutationObserver(function () {
        scheduleSync(false);
      });
      swObserver.observe(switcher, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-pressed", "class"],
      });
    }
  }

  function initBridge() {
    attachSwitcherObserver();
    syncServers(true);

    var bodyObserver = new MutationObserver(function () {
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