/* ── WinNotch Controller (Exact Nusa Architecture & Real-Time Sync) ── */

(() => {
  /* ── DOM References ── */
  const mn = document.getElementById("mn");
  const timeElements = document.querySelectorAll(".js-time");
  const dateElements = document.querySelectorAll(".js-date");
  const ringElements = document.querySelectorAll(".js-ring");
  const barContainers = document.querySelectorAll(".js-bars");
  const ambientElements = document.querySelectorAll(".js-ambient");
  const artElements = document.querySelectorAll(".js-art");
  const appElements = document.querySelectorAll(".js-app");
  const trackInfoElements = document.querySelectorAll(".js-track-info");

  // Seekbar
  const elapsedElements = document.querySelectorAll(".js-elapsed");
  const remainingElements = document.querySelectorAll(".js-remaining");
  const progTracks = document.querySelectorAll(".js-prog-track");
  const progBars = document.querySelectorAll(".js-prog-bar");

  // Controls
  const lyricsBtns = document.querySelectorAll(".js-lyrics-btn");
  const btnPrevs = document.querySelectorAll(".js-btn-prev");
  const btnPlayPauses = document.querySelectorAll(".js-btn-play-pause");
  const btnNexts = document.querySelectorAll(".js-btn-next");
  const pauseIcons = document.querySelectorAll(".js-icon-pause");
  const playIcons = document.querySelectorAll(".js-icon-play");
  const nextWidgetBtn = document.querySelector(".js-next-widget");

  // Lyrics container
  const lyr = document.getElementById("lyr");

  /* ── State ── */
  let isPinned = false;
  let isPlaying = true;
  let hoverTimeout = null;
  let leaveTimeout = null;
  let currentSessionApp = "Paper Sky";

  // Track playback timeline
  let trackDuration = 256; // 04:16
  let trackCurrent = 193; // 03:13

  // Browser & Lyrics Support state
  let hasLyricsSupport = true;
  let lastTrackTitle = "";
  let lastTrackArtist = "";

  // Lyrics State
  const DEMO_LYRICS = [
    "Morning folds the city light",
    "into paper birds tonight",
    "If I could be by your side",
    "I'd give you all my seasons",
    "every summer, every rain",
    "calling out your name"
  ];

  let lyricsList = []; // [{ time: number, text: string }]
  let currentLyricIdx = -1;
  let lyricsType = "demo"; // "demo" | "synced" | "plain" | "none"
  const lyricsCache = new Map();

  // Browser preview mode
  if (!window.winNotch) {
    document.body.classList.add("browser-preview");
  }

  /* ── 1. Real-Time Clock & Date (Synced to Windows) ── */
  const D = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function updateClock() {
    const now = new Date();
    const t = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    const dStr = `${D[now.getDay()]} ${now.getDate()} ${M[now.getMonth()]} ${now.getFullYear()}`;

    timeElements.forEach(el => el.textContent = t);
    dateElements.forEach(el => el.textContent = dStr);
  }
  updateClock();
  setInterval(updateClock, 1000);

  /* ── 2. Battery Ring & Device Detection (PC vs Laptop) ── */
  async function updateBattery() {
    try {
      if (window.winNotch?.getBattery) {
        const batt = await window.winNotch.getBattery();
        if (batt && batt.hasBattery) {
          // LAPTOP DETECTED: Use actual battery percentage
          const pct = Math.max(0, Math.min(100, batt.level));
          document.documentElement.style.setProperty("--battery-p", `${pct}%`);
          ringElements.forEach(r => r.title = `Laptop Battery: ${pct}%${batt.charging ? ' (Charging)' : ''}`);
        } else {
          // PC DESKTOP (No battery): Set to 100% full green ring
          document.documentElement.style.setProperty("--battery-p", "100%");
          ringElements.forEach(r => r.title = "PC Desktop (AC Power - Full)");
        }
      } else {
        // Fallback: 100% full
        document.documentElement.style.setProperty("--battery-p", "100%");
      }
    } catch {
      document.documentElement.style.setProperty("--battery-p", "100%");
    }
  }
  updateBattery();
  setInterval(updateBattery, 5000);

  /* ── 3. Smooth Jelly Spring State Switcher ── */
  function show(s) {
    const prev = mn.dataset.s;
    mn.dataset.s = s;

    // Electron window bounds resizing with ample safety buffer for jelly spring overshoot
    if (s === "music" || s === "pomo" || s === "water" || s === "shelf" || s === "todo" || s === "note") {
      window.winNotch?.expandWindow({ width: 600, height: 200 });
    } else if (s === "lyrics") {
      window.winNotch?.expandWindow({ width: 730, height: 200 });
    } else if (s === "bt" || s === "charge") {
      window.winNotch?.hudWindow({ width: 440, height: 110 });
    } else if (s === "msg") {
      window.winNotch?.hudWindow({ width: 500, height: 110 });
    } else if (s === "idle") {
      // Delay collapsing window bounds until .62s jelly spring finishes
      setTimeout(() => {
        if (mn.dataset.s === "idle") {
          window.winNotch?.collapseWindow();
        }
      }, 640);
    }

    if (s !== "charge") {
      mn.classList.remove("low-battery-pulse");
    }

    if (s === "water" && prev !== "water") {
      setTimeout(waterGrow, 220);
    }
    if (s === "pomo") {
      updatePomoUI();
    }
    if (s === "note") {
      fetchNotes?.();
    }
  }

  /* ── Hover Delay & Jelly Buffer ── */
  mn.addEventListener("mouseenter", () => {
    clearTimeout(leaveTimeout);
    // 220ms deliberate buffer so cursor casually passing by does not trigger it
    hoverTimeout = setTimeout(() => {
      if (mn.dataset.s === "idle") {
        show("music");
      }
    }, 220);
  });

  mn.addEventListener("mouseleave", () => {
    clearTimeout(hoverTimeout);
    if (!isPinned) {
      // 750ms comfortable buffer so user has time before notch snaps shut
      leaveTimeout = setTimeout(() => {
        if (!isPinned) {
          show("idle");
        }
      }, 750);
    }
  });

  // Clicking idle notch expands and pins it
  document.querySelector(".l-idle")?.addEventListener("click", (e) => {
    e.stopPropagation();
    clearTimeout(hoverTimeout);
    isPinned = true;
    show("music");
  });

  // Clicking expanded header time/date/battery unpins and collapses
  document.querySelectorAll(".l-hdr .js-ring, .l-hdr .js-time, .l-hdr .js-date").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      isPinned = false;
      show("idle");
    });
  });

  // Clicking outside notch collapses it back to idle
  document.addEventListener("click", (e) => {
    if (!mn.contains(e.target)) {
      isPinned = false;
      show("idle");
    }
  });

  /* ── 4. Dynamic Media Session & Ambient Color Sync ── */
  const APP_PALETTES = {
    spotify: ["#1db954", "#121212", "#1ed760"],
    chrome:  ["#4285f4", "#ea4335", "#fbbc05"],
    brave:   ["#ff5500", "#fb542b", "#5633ff"],
    edge:    ["#0078d7", "#00bcf2", "#004b87"],
    firefox: ["#ff7139", "#ff3a00", "#9059ff"],
    vlc:     ["#ff8800", "#ffaa00", "#ff5500"],
    apple:   ["#fa2d48", "#fc3c44", "#ff2d55"],
    default: ["#19b8ff", "#2d5bff", "#7b4bff"]
  };

  function applyAppPalette(appName) {
    const key = (appName || "").toLowerCase();
    let pal = APP_PALETTES.default;
    for (const [k, p] of Object.entries(APP_PALETTES)) {
      if (key.includes(k)) {
        pal = p;
        break;
      }
    }
    document.documentElement.style.setProperty("--c1", pal[0]);
    document.documentElement.style.setProperty("--c2", pal[1]);
    document.documentElement.style.setProperty("--c3", pal[2]);
    document.documentElement.style.setProperty(
      "--glow",
      `linear-gradient(90deg, ${pal[0]}, ${pal[1]} 55%, ${pal[2]})`
    );
  }

  /* ── Browser Detection for Lyrics Rule ── */
  const BROWSER_KEYWORDS = [
    "brave", "chrome", "edge", "msedge", "firefox", "opera", "vivaldi", "arc", "chromium", "browser"
  ];

  function isBrowserApp(appName) {
    if (!appName) return false;
    const lower = appName.toLowerCase();
    return BROWSER_KEYWORDS.some(k => lower.includes(k));
  }

  function setLyricsSupport(supported) {
    hasLyricsSupport = supported;
    lyricsBtns.forEach(btn => {
      btn.style.display = supported ? "" : "none";
    });
    // If playing in a browser, disable lyrics mode and force back to music mode
    if (!supported && mn.dataset.s === "lyrics") {
      show("music");
    }
  }

  /* ── 5. Real Lyrics Fetching & Synchronization (LRCLIB API) ── */
  function parseLrc(lrcText) {
    if (!lrcText) return [];
    const lines = lrcText.split("\n");
    const result = [];
    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/;
    for (const line of lines) {
      const match = line.match(timeRegex);
      if (match) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const ms = match[3] ? parseInt(match[3].padEnd(3, "0").slice(0, 3), 10) : 0;
        const timeInSec = min * 60 + sec + ms / 1000;
        const text = match[4].trim();
        if (text) {
          result.push({ time: timeInSec, text });
        }
      }
    }
    return result;
  }

  function escapeHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderLyrics(items, activeIndex = 0) {
    if (!lyr) return;
    if (!items || items.length === 0) {
      lyr.innerHTML = `<li class="on" style="font-size: 13.5px; opacity: 0.6; padding: 22px 0;">♪ Instrumental / No lyrics found ♪</li>`;
      lyr.style.transform = "translateY(24px)";
      return;
    }

    lyr.innerHTML = items
      .map((it, idx) => `<li class="${idx === activeIndex ? 'on' : ''}">${escapeHtml(it.text || it)}</li>`)
      .join("");

    scrollToLyric(activeIndex);
  }

  function scrollToLyric(index) {
    if (!lyr) return;
    const lis = lyr.querySelectorAll("li");
    if (!lis || lis.length === 0) return;
    currentLyricIdx = Math.max(0, Math.min(lis.length - 1, index));
    lis.forEach((li, i) => li.classList.toggle("on", i === currentLyricIdx));
    const activeLi = lis[currentLyricIdx];
    if (activeLi) {
      const offset = 56 - activeLi.offsetTop - activeLi.offsetHeight / 2;
      lyr.style.transform = `translateY(${offset}px)`;
    }
  }

  function syncLyricsToTime(currentSec) {
    if (!lyr || !lyricsList || lyricsList.length === 0) return;

    if (lyricsType === "synced") {
      // 350ms lead-in anticipation so lyric illuminates right as vocal begins
      const adjustedSec = currentSec + 0.35;
      let idx = -1;
      for (let i = 0; i < lyricsList.length; i++) {
        if (adjustedSec >= lyricsList[i].time) {
          idx = i;
        } else {
          break;
        }
      }
      if (idx >= 0 && idx !== currentLyricIdx) {
        scrollToLyric(idx);
      }
    }
  }

  async function updateLyricsForTrack(artist, title, duration) {
    if (!hasLyricsSupport) return;

    if (!title || title === "Paper Sky") {
      lyricsType = "demo";
      lyricsList = DEMO_LYRICS.map((text, i) => ({ time: i * 4, text }));
      renderLyrics(lyricsList, 4); // Exact line from Lyric.png
      return;
    }

    const cleanTitle = title
      .replace(/\s*[\(\[](feat|ft|with|remaster|version|deluxe|live|radio|bonus|official)[^\)\]]*[\)\]]/gi, '')
      .replace(/\s*-\s*(feat|ft|remaster|live|acoustic|official).*/gi, '')
      .trim();
    const cleanArtist = (artist || "")
      .replace(/\s*[\(\[](feat|ft)[^\)\]]*[\)\]]/gi, '')
      .trim();

    const cacheKey = `${cleanArtist}:::${cleanTitle}`.toLowerCase();
    if (lyricsCache.has(cacheKey)) {
      const cached = lyricsCache.get(cacheKey);
      applyLyricsData(cached);
      return;
    }

    if (lyr) {
      lyr.innerHTML = `<li class="on" style="font-size: 13.5px; opacity: 0.6; padding: 22px 0;">Searching lyrics...</li>`;
      lyr.style.transform = "translateY(24px)";
    }

    try {
      // 1. Try exact get with duration
      let url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}`;
      if (cleanArtist) url += `&artist_name=${encodeURIComponent(cleanArtist)}`;
      if (duration && duration > 0) url += `&duration=${Math.round(duration)}`;

      let res = await fetch(url);
      let data = null;
      if (res.ok) {
        data = await res.json();
      }

      // 2. Fallback exact get without duration
      if (!data || (!data.syncedLyrics && !data.plainLyrics)) {
        let urlWithoutDur = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}`;
        if (cleanArtist) urlWithoutDur += `&artist_name=${encodeURIComponent(cleanArtist)}`;
        let res2 = await fetch(urlWithoutDur);
        if (res2.ok) {
          data = await res2.json();
        }
      }

      // 3. Fallback search
      if (!data || (!data.syncedLyrics && !data.plainLyrics)) {
        const q = cleanArtist ? `${cleanTitle} ${cleanArtist}` : cleanTitle;
        const searchRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`);
        if (searchRes.ok) {
          const list = await searchRes.json();
          if (Array.isArray(list) && list.length > 0) {
            data = list.find(it => it.syncedLyrics) || list[0];
          }
        }
      }

      lyricsCache.set(cacheKey, data);
      applyLyricsData(data);
    } catch (err) {
      console.warn("Lyrics fetch error:", err);
      applyLyricsData(null);
    }
  }

  function applyLyricsData(data) {
    if (data?.syncedLyrics) {
      lyricsType = "synced";
      lyricsList = parseLrc(data.syncedLyrics);
      renderLyrics(lyricsList, 0);
      syncLyricsToTime(trackCurrent);
    } else if (data?.plainLyrics) {
      lyricsType = "plain";
      const rawLines = data.plainLyrics.split("\n").map(l => l.trim()).filter(Boolean);
      lyricsList = rawLines.map((text, i) => ({ time: i * 4, text }));
      renderLyrics(lyricsList, 0);
    } else {
      lyricsType = "none";
      lyricsList = [];
      renderLyrics([]);
    }
  }

  // Initialize demo lyrics on startup
  lyricsType = "demo";
  lyricsList = DEMO_LYRICS.map((text, i) => ({ time: i * 4, text }));
  renderLyrics(lyricsList, 4);

  /* ── 6. Windows GSMTC Media Session Sync ── */
  let basePosition = 193;
  let lastSyncTime = performance.now();

  function getExactCurrentTime() {
    if (!isPlaying) return basePosition;
    const elapsed = (performance.now() - lastSyncTime) / 1000;
    return Math.min(trackDuration, basePosition + elapsed);
  }

  function calibratePlaybackTime(newPos, isPlay) {
    if (newPos === undefined || newPos === null) return;
    const currentEst = getExactCurrentTime();
    // Calibrate if drift is more than 300ms or if state changed
    if (Math.abs(newPos - currentEst) > 0.35 || !isPlay) {
      basePosition = newPos;
      lastSyncTime = performance.now();
      trackCurrent = newPos;
    }
  }

  function applyThumbnail(session) {
    if (session.thumbBase64) {
      artElements.forEach(el => {
        el.style.backgroundImage = `url("${session.thumbBase64}")`;
        el.style.backgroundSize = "cover";
        el.style.backgroundPosition = "center";
      });
    } else if (session.hasThumb) {
      const thumbUrl = `../assets/current_thumb.jpg?t=${Date.now()}`;
      artElements.forEach(el => {
        el.style.backgroundImage = `url("${thumbUrl}")`;
        el.style.backgroundSize = "cover";
        el.style.backgroundPosition = "center";
      });
    } else {
      artElements.forEach(el => {
        el.style.backgroundImage = ""; // Use CSS default vinyl disk
      });
    }
  }

  function handleMediaSession(session) {
    if (!session) return;
    if (session.hasMedia) {
      // 1. App Name (e.g., Spotify, Chrome, Brave)
      const appName = session.app || "Music";
      currentSessionApp = appName;
      appElements.forEach(el => el.textContent = appName);

      // 2. Track Info: (pemilik lagu - nama lagu)
      let metaText = "";
      if (session.artist && session.title) {
        metaText = `${session.artist} - ${session.title}`;
      } else {
        metaText = session.title || session.artist || "Playing Media";
      }
      trackInfoElements.forEach(el => el.textContent = metaText);

      // 3. Playback State
      if (typeof session.playing === "boolean" && session.playing !== isPlaying) {
        setPlaybackState(session.playing);
      }

      // 4. Timeline (Seekbar & Duration)
      if (session.duration && session.duration > 0) {
        trackDuration = session.duration;
      }
      if (session.position !== undefined) {
        calibratePlaybackTime(session.position, session.playing);
      }
      updateSeekbarUI();
      if (mn.dataset.s === "lyrics" && lyricsType === "synced") {
        syncLyricsToTime(trackCurrent);
      }

      // 5. Browser check: Browsers do NOT have lyrics support
      const isBrowser = isBrowserApp(appName);
      setLyricsSupport(!isBrowser);

      // 6. Track Change Check
      if (session.title !== lastTrackTitle || session.artist !== lastTrackArtist) {
        lastTrackTitle = session.title;
        lastTrackArtist = session.artist || "";
        applyAppPalette(appName);

        // Fetch live lyrics if dedicated music app (e.g. Spotify)
        if (!isBrowser) {
          updateLyricsForTrack(session.artist, session.title, session.duration);
        }

        applyThumbnail(session);
      } else {
        applyThumbnail(session);
      }
    } else {
      // Fallback idle / demo state (Paper Sky)
      setLyricsSupport(true);
      if (lastTrackTitle !== "Paper Sky") {
        lastTrackTitle = "Paper Sky";
        lastTrackArtist = "Lumen Coast";
        appElements.forEach(el => el.textContent = "Paper Sky");
        trackInfoElements.forEach(el => el.textContent = "Lumen Coast - Summer Flows");
        applyAppPalette("default");
        artElements.forEach(el => {
          el.style.backgroundImage = "";
        });
        updateLyricsForTrack("Lumen Coast", "Paper Sky", 256);
      }
    }
  }

  async function syncWindowsMedia() {
    try {
      if (window.winNotch?.getMediaSession) {
        const session = await window.winNotch.getMediaSession();
        handleMediaSession(session);
      }
    } catch (err) {
      console.warn("syncWindowsMedia error:", err);
    }
  }
  setInterval(syncWindowsMedia, 1000);
  syncWindowsMedia();

  // Instant IPC push update from main process
  window.winNotch?.onMediaUpdate((session) => {
    handleMediaSession(session);
  });

  /* ── 7. Playback Controls & Waveform ── */
  function setPlaybackState(playing) {
    isPlaying = playing;
    if (isPlaying) {
      lastSyncTime = performance.now();
      pauseIcons.forEach(i => i.style.display = "");
      playIcons.forEach(i => i.style.display = "none");
      barContainers.forEach(b => b.classList.remove("paused"));
    } else {
      basePosition = getExactCurrentTime();
      pauseIcons.forEach(i => i.style.display = "none");
      playIcons.forEach(i => i.style.display = "");
      barContainers.forEach(b => b.classList.add("paused"));
    }
  }

  btnPlayPauses.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const targetState = !isPlaying;
      setPlaybackState(targetState);
      window.winNotch?.mediaControl("playpause");
    });
  });

  btnPrevs.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      basePosition = 0;
      lastSyncTime = performance.now();
      trackCurrent = 0;
      updateSeekbarUI();
      syncLyricsToTime(0);
      window.winNotch?.mediaControl("prev");
    });
  });

  btnNexts.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      basePosition = 0;
      lastSyncTime = performance.now();
      trackCurrent = 0;
      updateSeekbarUI();
      syncLyricsToTime(0);
      window.winNotch?.mediaControl("next");
    });
  });

  /* ── 8. Seekbar & Progression ── */
  function formatSeconds(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function updateSeekbarUI() {
    elapsedElements.forEach(el => el.textContent = formatSeconds(Math.floor(trackCurrent)));
    const rem = Math.max(0, trackDuration - trackCurrent);
    remainingElements.forEach(el => el.textContent = `-${formatSeconds(Math.ceil(rem))}`);
    const pct = Math.min(100, (trackCurrent / trackDuration) * 100);
    progBars.forEach(b => b.style.width = `${pct}%`);
  }
  updateSeekbarUI();

  // High-frequency 100ms ticker for sub-second smooth progress and exact lyric synchronization
  setInterval(() => {
    if (isPlaying) {
      trackCurrent = getExactCurrentTime();
      updateSeekbarUI();

      if (mn.dataset.s === "lyrics" && lyricsType === "synced") {
        syncLyricsToTime(trackCurrent);
      }
    }
  }, 100);

  // Progressive cycling for demo or plain text lyrics
  setInterval(() => {
    if (mn.dataset.s === "lyrics" && isPlaying) {
      if (lyricsType === "demo" || lyricsType === "plain") {
        if (lyricsList.length > 0) {
          const nextIdx = (currentLyricIdx + 1) % lyricsList.length;
          scrollToLyric(nextIdx);
        }
      }
    }
  }, 2800);

  // Seekbar scrubbing
  progTracks.forEach(track => {
    track.addEventListener("click", (e) => {
      e.stopPropagation();
      const rect = track.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, clickX / rect.width));
      trackCurrent = Math.floor(pct * trackDuration);
      basePosition = trackCurrent;
      lastSyncTime = performance.now();
      updateSeekbarUI();
      syncLyricsToTime(trackCurrent);
      window.winNotch?.mediaControl("seek", { position: trackCurrent });
    });
  });

  /* ── 9. Lyrics Button Toggle ── */
  lyricsBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!hasLyricsSupport) return;
      if (mn.dataset.s === "lyrics") {
        show("music");
      } else {
        show("lyrics");
        if (lyricsType === "synced") {
          syncLyricsToTime(trackCurrent);
        } else if (lyricsList.length > 0) {
          scrollToLyric(currentLyricIdx >= 0 ? currentLyricIdx : 0);
        }
      }
    });
  });

  /* ── 10. Widget Switcher & Arrow Navigation ── */
  if (nextWidgetBtn) {
    nextWidgetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      nextWidgetBtn.style.transform = "translate(-50%, -50%) scale(0.85)";
      setTimeout(() => {
        nextWidgetBtn.style.transform = "";
        show("pomo");
      }, 150);
    });
  }

  // Pomodoro navigation arrows
  document.querySelector(".js-pomo-prev")?.addEventListener("click", (e) => {
    e.stopPropagation();
    show("music");
  });
  document.querySelector(".js-pomo-next")?.addEventListener("click", (e) => {
    e.stopPropagation();
    show("water");
  });

  // Water navigation arrows
  document.querySelector(".js-water-prev")?.addEventListener("click", (e) => {
    e.stopPropagation();
    show("pomo");
  });
  document.querySelector(".js-water-next")?.addEventListener("click", (e) => {
    e.stopPropagation();
    show("shelf");
  });

  // Shelf navigation arrows
  document.querySelector(".js-shelf-prev")?.addEventListener("click", (e) => {
    e.stopPropagation();
    show("water");
  });
  document.querySelector(".js-shelf-next")?.addEventListener("click", (e) => {
    e.stopPropagation();
    show("todo");
  });

  // Todo navigation arrows
  document.querySelector(".js-todo-prev")?.addEventListener("click", (e) => {
    e.stopPropagation();
    show("shelf");
  });
  document.querySelector(".js-todo-next")?.addEventListener("click", (e) => {
    e.stopPropagation();
    show("note");
  });

  // Note navigation arrows
  document.querySelector(".js-note-prev")?.addEventListener("click", (e) => {
    e.stopPropagation();
    show("todo");
  });
  document.querySelector(".js-note-next")?.addEventListener("click", (e) => {
    e.stopPropagation();
    show("music");
  });

  // Pagination dots navigation (6 states)
  const dotElements = document.querySelectorAll(".dots i");
  const dotStates = ["music", "pomo", "water", "shelf", "todo", "note"];
  dotElements.forEach((dot, idx) => {
    dot.addEventListener("click", (e) => {
      e.stopPropagation();
      if (dotStates[idx]) {
        show(dotStates[idx]);
      }
    });
  });

  /* ── 10b. Web Audio API Alarm & Chime Sound Synthesizer ── */
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) audioCtx = new AudioCtxClass();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, type, startTime, duration, vol = 0.25) {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(vol, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch {}
  }

  function playPomodoroAlarm() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Pleasant double 4-tone ascending bell chime (E5, G#5, B5, E6)
    const notes = [659.25, 830.61, 987.77, 1318.51];
    [0, 0.7].forEach((offset) => {
      notes.forEach((freq, idx) => {
        playTone(freq, "sine", now + offset + idx * 0.12, 0.45, 0.28);
        playTone(freq * 2, "triangle", now + offset + idx * 0.12, 0.25, 0.08);
      });
    });

    const pomoEl = document.querySelector(".l-pomo");
    if (pomoEl) {
      pomoEl.classList.add("pomo-alarm-active");
      setTimeout(() => pomoEl.classList.remove("pomo-alarm-active"), 3500);
    }
  }

  function playWaterChime() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    try {
      // Refreshing water droplet slide (420Hz -> 880Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.16);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.32, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    } catch {}

    // Crystal harmonic chime bells
    const notes = [783.99, 1046.5, 1318.51, 1567.98];
    notes.forEach((freq, i) => {
      playTone(freq, "sine", now + 0.12 + i * 0.1, 0.5, 0.18);
    });

    const waterEl = document.querySelector(".l-water");
    if (waterEl) {
      waterEl.classList.add("water-alarm-active");
      setTimeout(() => waterEl.classList.remove("water-alarm-active"), 3000);
    }
  }

  /* ── 11. Pomodoro Logic & Interactive Timer ── */
  const pomoTimeEl = document.querySelector(".js-pomo-time");
  const pomoModeEl = document.querySelector(".js-pomo-mode");
  const pomoResetBtn = document.querySelector(".js-pomo-reset");
  const pomoToggleBtn = document.querySelector(".js-pomo-toggle");
  const pomoPlayIcon = document.querySelector(".js-pomo-play-icon");
  const pomoPauseIcon = document.querySelector(".js-pomo-pause-icon");
  const pomoBreakBtn = document.querySelector(".js-pomo-break");
  const pomoFocusBtn = document.querySelector(".js-pomo-focus");
  const pomoRing = document.querySelector(".js-pomo-ring, .pring");
  const pomoGlow = document.querySelector(".js-pomo-glow, .pglow");

  let pomoMode = "focus"; // "focus" | "break"
  let customFocusDuration = 25 * 60;
  let customBreakDuration = 5 * 60;
  let pomoTimeLeft = customFocusDuration;
  let pomoRunning = false;
  let pomoInterval = null;
  let isEditingPomo = false;

  function formatPomo(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function updatePomoUI() {
    if (pomoTimeEl && !isEditingPomo) {
      pomoTimeEl.textContent = formatPomo(pomoTimeLeft);
    }
    if (pomoModeEl) {
      pomoModeEl.textContent = pomoMode === "focus" ? "Focus time" : "Short break";
    }

    if (pomoPlayIcon && pomoPauseIcon) {
      pomoPlayIcon.style.display = pomoRunning ? "none" : "";
      pomoPauseIcon.style.display = pomoRunning ? "" : "none";
    }

    if (pomoFocusBtn) pomoFocusBtn.classList.toggle("active", pomoMode === "focus");
    if (pomoBreakBtn) pomoBreakBtn.classList.toggle("active", pomoMode === "break");

    // Dynamic depleting clock ring
    const total = pomoMode === "focus" ? customFocusDuration : customBreakDuration;
    const pct = Math.max(0, Math.min(1, pomoTimeLeft / total));
    const deg = (pct * 360).toFixed(1);
    const color = pomoMode === "focus" ? "#ff4b55" : "#38d36f";

    if (pomoRing) {
      pomoRing.style.setProperty("--pomo-deg", `${deg}deg`);
      pomoRing.style.setProperty("--pomo-color", color);
      pomoRing.style.background = `conic-gradient(from 0deg, ${color} 0deg, ${color} ${deg}deg, rgba(255, 255, 255, 0.12) ${deg}deg 360deg)`;
      pomoRing.style.boxShadow = pomoMode === "focus"
        ? "0 0 18px rgba(255, 70, 70, 0.35)"
        : "0 0 18px rgba(56, 211, 111, 0.35)";
    }
    if (pomoGlow) {
      pomoGlow.style.background = pomoMode === "focus"
        ? `radial-gradient(circle, rgba(255,60,60,${(0.1 + 0.22 * pct).toFixed(2)}), transparent 65%)`
        : `radial-gradient(circle, rgba(56,211,111,${(0.1 + 0.22 * pct).toFixed(2)}), transparent 65%)`;
    }
  }

  function togglePomo() {
    pomoRunning = !pomoRunning;
    if (pomoRunning) {
      pomoInterval = setInterval(() => {
        if (pomoTimeLeft > 0) {
          pomoTimeLeft--;
          updatePomoUI();
        } else {
          clearInterval(pomoInterval);
          pomoRunning = false;
          playPomodoroAlarm();
          if (pomoMode === "focus") {
            pomoMode = "break";
            pomoTimeLeft = customBreakDuration;
          } else {
            pomoMode = "focus";
            pomoTimeLeft = customFocusDuration;
          }
          updatePomoUI();
        }
      }, 1000);
    } else {
      clearInterval(pomoInterval);
    }
    updatePomoUI();
  }

  pomoToggleBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePomo();
  });

  // Bug-free Pomodoro Reset: smooth SVG spin without touching parent container transform
  pomoResetBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    clearInterval(pomoInterval);
    pomoRunning = false;
    pomoTimeLeft = pomoMode === "focus" ? customFocusDuration : customBreakDuration;
    updatePomoUI();

    const svg = pomoResetBtn.querySelector("svg");
    if (svg) {
      svg.style.transition = "transform 0.45s cubic-bezier(0.34, 1.5, 0.5, 1)";
      svg.style.transform = "rotate(-360deg)";
      setTimeout(() => {
        svg.style.transition = "none";
        svg.style.transform = "none";
      }, 460);
    }
  });

  // Double-click Pomodoro Time to customize duration
  pomoTimeEl?.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    if (isEditingPomo) return;
    isEditingPomo = true;

    const currentMins = Math.max(1, Math.round(pomoTimeLeft / 60));
    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = "180";
    input.value = currentMins;
    input.className = "pomo-inline-input";
    input.title = "Press Enter to save minutes";

    pomoTimeEl.innerHTML = "";
    pomoTimeEl.appendChild(input);
    input.focus();
    input.select();

    const saveDuration = () => {
      if (!isEditingPomo) return;
      isEditingPomo = false;
      let val = parseInt(input.value, 10);
      if (isNaN(val) || val <= 0) {
        val = pomoMode === "focus" ? 25 : 5;
      }
      val = Math.min(180, Math.max(1, val));

      if (pomoMode === "focus") {
        customFocusDuration = val * 60;
      } else {
        customBreakDuration = val * 60;
      }

      clearInterval(pomoInterval);
      pomoRunning = false;
      pomoTimeLeft = val * 60;
      updatePomoUI();
    };

    input.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        saveDuration();
      } else if (evt.key === "Escape") {
        evt.preventDefault();
        isEditingPomo = false;
        updatePomoUI();
      }
    });

    input.addEventListener("blur", () => {
      saveDuration();
    });
  });

  pomoFocusBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    clearInterval(pomoInterval);
    pomoRunning = false;
    pomoMode = "focus";
    pomoTimeLeft = customFocusDuration;
    updatePomoUI();
  });

  pomoBreakBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    clearInterval(pomoInterval);
    pomoRunning = false;
    pomoMode = "break";
    pomoTimeLeft = customBreakDuration;
    updatePomoUI();
  });

  /* ── 12. Water Reminder Logic, Dual Subviews & Settings Modal ── */
  const waterValEl = document.querySelector(".js-water-val");
  const waterPctEl = document.querySelector(".js-water-pct");
  const waterGoalEl = document.querySelector(".js-water-goal");
  const waterToggleBtn = document.querySelector(".js-water-toggle");
  const waterDrinkBtn = document.querySelector(".js-water-drink");
  const waterSettingsBtn = document.querySelector(".js-water-settings");

  // Dual Sub-views (Chart vs Circular Gauge)
  const wDot1 = document.querySelector(".js-wdot-1");
  const wDot2 = document.querySelector(".js-wdot-2");
  const wViewChart = document.querySelector(".js-wview-chart");
  const wViewGauge = document.querySelector(".js-wview-gauge");
  const wGaugeFill = document.querySelector(".js-w-gauge-fill");
  const wGaugeDot = document.querySelector(".js-w-gauge-dot");
  const wGaugePct = document.querySelector(".js-w-gauge-pct");
  const wGaugeToggle = document.querySelector(".js-w-gauge-toggle");

  // Settings Modal
  const wModal = document.querySelector(".js-w-settings-modal");
  const wModalClose = document.querySelector(".js-w-close-modal");
  const wModalSave = document.querySelector(".js-w-save");
  const wModalMinus = document.querySelector(".js-w-minus");
  const wModalPlus = document.querySelector(".js-w-plus");
  const wModalGoal = document.querySelector(".js-w-modal-goal");
  const wResetDrankBtn = document.querySelector(".js-w-reset-drank");

  let waterDrank = 1.5;
  let waterGoal = 1.5;
  let waterSubView = "chart"; // "chart" | "gauge"

  function updateWaterGauge(pct) {
    if (wGaugePct) wGaugePct.textContent = `${pct}`;
    const p = Math.min(1, Math.max(0, pct / 100));
    const totalArcLen = 155.51; // 270 deg arc with R=33
    const offset = (1 - p) * totalArcLen;

    if (wGaugeFill) {
      wGaugeFill.style.strokeDashoffset = `${offset}`;
    }

    if (wGaugeDot) {
      if (p <= 0.01) {
        wGaugeDot.style.opacity = "0";
      } else {
        wGaugeDot.style.opacity = "1";
        const angleDeg = 135 + p * 270;
        const rad = (angleDeg * Math.PI) / 180;
        const cx = 45 + 33 * Math.cos(rad);
        const cy = 45 + 33 * Math.sin(rad);
        wGaugeDot.setAttribute("cx", cx.toFixed(1));
        wGaugeDot.setAttribute("cy", cy.toFixed(1));
      }
    }
  }

  function updateWaterUI() {
    if (waterValEl) waterValEl.textContent = waterDrank.toFixed(1);
    const targetLabel = document.querySelector(".l-water .vc.sb, .l-water span.dim.sb");
    if (targetLabel) targetLabel.textContent = `/ ${waterGoal.toFixed(1)} L`;
    if (wModalGoal) wModalGoal.textContent = `${waterGoal.toFixed(1)} L`;

    const pct = Math.round((waterDrank / waterGoal) * 100);
    if (waterPctEl) waterPctEl.textContent = `${pct}%`;
    if (waterGoalEl) waterGoalEl.textContent = pct >= 100 ? "Goal reached" : "Keep going";
    const wbar = document.querySelector(".wbar");
    if (wbar) {
      wbar.style.width = `${Math.min(152, (pct / 100) * 152)}px`;
    }
    updateWaterGauge(pct);
  }

  function waterGrow() {
    const bars = document.querySelectorAll("#chart .wgrow");
    const wbar = document.querySelector(".wbar");
    bars.forEach(b => {
      b.style.transition = "none";
      b.style.height = "0px";
    });
    if (wbar) {
      wbar.style.transition = "none";
      wbar.style.width = "0px";
      void wbar.offsetWidth;
      wbar.style.transition = "";
      const pct = Math.min(100, (waterDrank / waterGoal) * 100);
      wbar.style.width = `${(pct / 100) * 152}px`;
    }
    setTimeout(() => {
      bars.forEach(b => {
        b.style.transition = "";
        b.style.height = b.dataset.h;
      });
    }, 40);
  }

  function setWaterSubView(view) {
    waterSubView = view;
    if (view === "chart") {
      wDot1?.classList.add("on");
      wDot2?.classList.remove("on");
      if (wViewChart) wViewChart.style.display = "";
      if (wViewGauge) wViewGauge.style.display = "none";
      waterGrow();
    } else {
      wDot2?.classList.add("on");
      wDot1?.classList.remove("on");
      if (wViewChart) wViewChart.style.display = "none";
      if (wViewGauge) wViewGauge.style.display = "";
      const pct = Math.round((waterDrank / waterGoal) * 100);
      updateWaterGauge(pct);
    }
  }

  wDot1?.addEventListener("click", (e) => {
    e.stopPropagation();
    setWaterSubView("chart");
  });

  wDot2?.addEventListener("click", (e) => {
    e.stopPropagation();
    setWaterSubView("gauge");
  });

  wGaugeToggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    setWaterSubView("chart");
  });

  document.querySelector(".js-wview-chart")?.addEventListener("click", (e) => {
    if (e.target.closest(".wbtn, .sw, .arw")) return;
    setWaterSubView("gauge");
  });

  function openWaterSettings() {
    if (wModal) {
      if (wModalGoal) wModalGoal.textContent = `${waterGoal.toFixed(1)} L`;
      wModal.style.display = "flex";
    }
  }

  function closeWaterSettings() {
    if (wModal) {
      wModal.style.display = "none";
    }
  }

  waterSettingsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openWaterSettings();
  });

  wModalClose?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeWaterSettings();
  });

  wModalSave?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeWaterSettings();
  });

  wModalMinus?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (waterGoal > 0.5) {
      waterGoal = Math.round((waterGoal - 0.25) * 100) / 100;
      updateWaterUI();
    }
  });

  wModalPlus?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (waterGoal < 5.0) {
      waterGoal = Math.round((waterGoal + 0.25) * 100) / 100;
      updateWaterUI();
    }
  });

  wResetDrankBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    waterDrank = 0;
    updateWaterUI();
    if (waterSubView === "chart") waterGrow();
  });

  waterToggleBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    waterToggleBtn.classList.toggle("off");
  });

  // Double click bell icon to preview/test water alarm chime
  waterToggleBtn?.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    playWaterChime();
  });

  waterDrinkBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasGoalReached = waterDrank >= waterGoal;
    waterDrank = Math.round((waterDrank + 0.25) * 100) / 100;
    updateWaterUI();
    waterDrinkBtn.style.transform = "scale(0.92)";
    setTimeout(() => { waterDrinkBtn.style.transform = ""; }, 180);
    playWaterChime();
  });

  // Periodic water reminder alarm check (fires every 25 minutes if notifications enabled)
  setInterval(() => {
    if (waterToggleBtn && !waterToggleBtn.classList.contains("off")) {
      playWaterChime();
    }
  }, 25 * 60 * 1000);

  /* ── 13. Shelf Controller (Drag & Drop, Native Drag-Out, Copy & Open) ── */
  const shelfEl = document.getElementById("shelf");
  const shCv = document.getElementById("shCv");
  const shClearBtn = document.querySelector(".js-sh-clear");
  const shCardsContainer = document.querySelector(".js-sh-cards");

  const SHELF_STORAGE_KEY = "winnotch_shelf_items";
  let shelfItems = [];

  function saveShelfToStorage() {
    try {
      localStorage.setItem(SHELF_STORAGE_KEY, JSON.stringify(shelfItems));
    } catch {}
  }

  function showShelfFeedback(msg) {
    let fb = document.querySelector(".js-shelf-feedback");
    if (!fb) {
      fb = document.createElement("div");
      fb.className = "todo-toast js-shelf-feedback";
      fb.style.left = "210px";
      fb.style.bottom = "8px";
      shelfEl?.appendChild(fb);
    }
    fb.textContent = msg;
    fb.classList.add("show");
    setTimeout(() => fb.classList.remove("show"), 2200);
  }

  function createShelfCardElement(item) {
    const card = document.createElement("div");
    card.className = "a sh-card in";
    card.draggable = true;
    card.dataset.filePath = item.path || "";
    card.title = `${item.name}\n• Klik: Buka file/folder\n• Drag: Taruh ke Desktop/folder lain\n• Klik kanan: Copy ke Clipboard (Ctrl+V)`;

    let thumbHtml = "";
    if (item.isFolder) {
      thumbHtml = `<span class="sh-thumb t-folder"><svg viewBox="0 0 44 44"><path d="M4 11a3 3 0 0 1 3-3h10l4 4h16a3 3 0 0 1 3 3v19a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="#e8a720"></path><path d="M4 16h36v18a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="#ffc94d"></path></svg></span>`;
    } else if (item.isImg && item.path) {
      const clean = item.path.replace(/\\/g, "/");
      thumbHtml = `<span class="sh-thumb t-img" style="background-image:url('file:///${encodeURI(clean)}');background-size:cover;background-position:center;"></span>`;
    } else {
      thumbHtml = `<span class="sh-thumb ${item.isImg ? "t-img" : "t-file"}"></span>`;
    }

    card.innerHTML = `
      <button type="button" class="sh-card-del" title="Hapus dari Shelf">✕</button>
      ${thumbHtml}
      <span class="sh-name" title="${item.name}">${item.name}</span>
      <span class="sh-size">${item.size || ""}</span>
    `;

    // 1. Delete "X" button
    const delBtn = card.querySelector(".sh-card-del");
    delBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      card.style.transform = "scale(0.7) translateY(12px)";
      card.style.opacity = "0";
      setTimeout(() => {
        shelfItems = shelfItems.filter((i) => i.id !== item.id);
        saveShelfToStorage();
        renderShelfCards();
      }, 160);
    });

    // 2. Click to open in Windows
    card.addEventListener("click", (e) => {
      if (e.target.closest(".sh-card-del")) return;
      const p = card.dataset.filePath;
      if (p && window.winNotch?.openFile) {
        window.winNotch.openFile(p);
      } else {
        showShelfFeedback(`"${item.name}" (Klik area Shelf untuk pilih file)`);
      }
    });

    // 3. Drag out to desktop / File Explorer (Native Windows File Drag)
    card.addEventListener("dragstart", (e) => {
      const p = card.dataset.filePath;
      if (p && window.winNotch?.startDrag) {
        e.preventDefault();
        window.winNotch.startDrag({ file: p, id: item.id });
      } else {
        showShelfFeedback("Path file belum terhubung.");
      }
    });

    // Remove card when drag operation finishes
    card.addEventListener("dragend", () => {
      shelfItems = shelfItems.filter((i) => i.id !== item.id);
      saveShelfToStorage();
      renderShelfCards();
      showShelfFeedback(`"${item.name}" dipindahkan dari Shelf`);
    });

    // 4. Right click: Copy file path for Ctrl+V paste
    card.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const p = card.dataset.filePath;
      if (p && window.winNotch?.copyFile) {
        window.winNotch.copyFile(p);
        showShelfFeedback(`"${item.name}" disalin! Bisa Ctrl+V`);
      }
    });

    return card;
  }

  // Handle drag-out completion event from main process
  window.winNotch?.onFileDraggedOut?.((data) => {
    const targetId = data?.id;
    const targetFile = data?.file;
    const found = shelfItems.find((i) => (targetId && i.id === targetId) || (targetFile && i.path === targetFile));
    if (found) {
      shelfItems = shelfItems.filter((i) => i.id !== found.id);
      saveShelfToStorage();
      renderShelfCards();
      showShelfFeedback(`"${found.name}" dipindahkan dari Shelf`);
    }
  });

  function renderShelfCards() {
    if (!shCardsContainer) return;
    shCardsContainer.innerHTML = "";
    shelfItems.forEach((item, idx) => {
      const card = createShelfCardElement(item);
      card.style.left = `${44 + (idx % 5) * 68}px`;
      shCardsContainer.appendChild(card);
    });
    shelfEl?.classList.toggle("has", shelfItems.length > 0);
  }

  // Clear all files
  shClearBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    shelfItems = [];
    saveShelfToStorage();
    renderShelfCards();
  });

  // Browse and add files via Windows File Picker
  const shZone = document.querySelector(".js-sh-zone");

  async function browseAndAddShelfFiles() {
    if (window.winNotch?.selectShelfFiles) {
      const selected = await window.winNotch.selectShelfFiles();
      if (selected && selected.length > 0) {
        selected.forEach((item, idx) => {
          shelfItems.push({
            id: Date.now().toString() + "_" + idx,
            name: item.name,
            size: item.size,
            path: item.path,
            isFolder: item.isFolder,
            isImg: item.isImg
          });
        });
        saveShelfToStorage();
        renderShelfCards();
        shDropNow();
      }
    } else {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.multiple = true;
      fileInput.onchange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
          for (let i = 0; i < e.target.files.length; i++) {
            const f = e.target.files[i];
            const isImg = f.type && f.type.startsWith("image/");
            shelfItems.push({
              id: Date.now().toString() + "_" + i,
              name: f.name,
              size: `${Math.max(1, Math.round(f.size / 1024))} KB`,
              path: "",
              isFolder: false,
              isImg
            });
          }
          saveShelfToStorage();
          renderShelfCards();
          shDropNow();
        }
      };
      fileInput.click();
    }
  }

  // Click on drop zone or empty shelf area to browse files
  shZone?.addEventListener("click", (e) => {
    e.stopPropagation();
    browseAndAddShelfFiles();
  });

  shelfEl?.addEventListener("click", (e) => {
    if (e.target.closest(".sh-card, .arw, .sh-clear, .sh-card-del")) return;
    browseAndAddShelfFiles();
  });

  // Global Drag Detection: Dragging files from Windows towards notch automatically expands and opens Shelf!
  window.addEventListener("dragenter", (e) => {
    e.preventDefault();
    clearTimeout(hoverTimeout);
    clearTimeout(leaveTimeout);
    if (mn.dataset.s !== "shelf") {
      isPinned = true;
      show("shelf");
    }
    shelfEl?.classList.add("hover");
    shSetHot(true);
  });

  window.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (mn.dataset.s !== "shelf") {
      isPinned = true;
      show("shelf");
    }
    shelfEl?.classList.add("hover");
    shSetHot(true);
  });

  window.addEventListener("dragleave", (e) => {
    if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
      shelfEl?.classList.remove("hover");
      shSetHot(false);
    }
  });

  // Dropping files into Shelf
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    shelfEl?.classList.remove("hover");
    shSetHot(false);

    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];

        // Retrieve real Windows filesystem path through webUtils in preload!
        let realPath = "";
        if (window.winNotch?.getPathForFile) {
          realPath = window.winNotch.getPathForFile(file) || "";
        }
        if (!realPath && file.path) {
          realPath = file.path;
        }

        const isImg = file.type ? file.type.startsWith("image/") : /\.(jpe?g|png|gif|webp|svg)$/i.test(file.name);
        const isFolder = !file.type && !file.name.includes(".");
        const sizeStr = isFolder
          ? "Folder"
          : file.size > 1048576
          ? `${(file.size / 1048576).toFixed(1)} MB`
          : `${Math.max(1, Math.round(file.size / 1024))} KB`;

        shelfItems.push({
          id: Date.now().toString() + "_" + i,
          name: file.name,
          size: sizeStr,
          path: realPath,
          isFolder,
          isImg
        });
      }
      saveShelfToStorage();
      renderShelfCards();
      shDropNow();
    }
  });

  // Initialize shelf items
  function initShelf() {
    try {
      const saved = localStorage.getItem(SHELF_STORAGE_KEY);
      if (saved) {
        shelfItems = JSON.parse(saved);
      }
    } catch {
      shelfItems = [];
    }

    // If empty, supply default demo files and attach real paths
    if (!shelfItems || shelfItems.length === 0) {
      shelfItems = [
        { id: "demo_1", name: "beach.jpg", size: "2.4 MB", path: "", isFolder: false, isImg: true },
        { id: "demo_2", name: "Project files", size: "Folder", path: "", isFolder: true, isImg: false }
      ];
    }

    if (window.winNotch?.getDemoShelfFiles) {
      window.winNotch.getDemoShelfFiles().then((demoFiles) => {
        if (demoFiles) {
          const b = shelfItems.find((i) => i.name === "beach.jpg");
          const p = shelfItems.find((i) => i.name === "Project files");
          if (b && (!b.path || b.path === "") && demoFiles.beach) b.path = demoFiles.beach;
          if (p && (!p.path || p.path === "") && demoFiles.projectFiles) p.path = demoFiles.projectFiles;
          renderShelfCards();
        }
      });
    }

    renderShelfCards();
  }
  initShelf();

  // Shelf Island Gulp Canvas Glow (Authentic fluid physics)
  let sc = null;
  if (shCv) sc = shCv.getContext("2d");
  const PAL = [[40, 170, 240], [52, 104, 236], [104, 78, 222]];
  const SH_SPEED = 0.7;
  let shHov = 0, shHv = 0, shDropT = -1, shDx = 210, shCx = 210, shG = 0, shGv = 0, shHot = false, shLast = 0, shRaf = 0;
  const shCl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const shSm = x => { x = shCl(x); return x * x * (3 - 2 * x); };
  function shMix(u) { u = shCl(u); const [a, b, k] = u < .5 ? [PAL[0], PAL[1], u * 2] : [PAL[1], PAL[2], (u - .5) * 2]; return a.map((v, i) => Math.round(v + (b[i] - v) * k)); }
  const shRgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  function shDraw() {
    if (!sc) return;
    const W = 420, H = 140, c = sc;
    c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, W, H);
    const d = shDropT, rise = d >= 0 && d < 1.1 ? Math.sin(shSm(d / 1.1) * Math.PI) : 0;
    const fade = d >= 0 ? (d < .9 ? 1 : 1 - shSm((d - .9) / 1.1)) : 1;
    const base = (.26 * shHov + .34 * rise) * fade, pool = (.42 * shHov + .28 * rise) * fade;
    if (base > .004) {
      const g = c.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, shRgba(PAL[0], base));
      g.addColorStop(.5, shRgba(PAL[1], base));
      g.addColorStop(1, shRgba(PAL[2], base));
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }
    const px = d >= 0 ? shDx : shCx;
    if (pool > .004) {
      const col = shMix(px / W), R = 170 + 60 * rise, g = c.createRadialGradient(px, H + 18, 0, px, H + 18, R);
      g.addColorStop(0, shRgba(col.map(v => Math.min(255, v + 51)), pool));
      g.addColorStop(.55, shRgba(col, pool * .45));
      g.addColorStop(1, shRgba(col, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }
    if (d >= 0 && d < 1.4) {
      const q = 1 - Math.pow(1 - d / 1.4, 3), r = 24 + 430 * q, w = 30, a = .22 * (1 - q);
      const g = c.createRadialGradient(px, H - 14, Math.max(0, r - w), px, H - 14, r + w);
      g.addColorStop(0, "rgba(200,236,255,0)");
      g.addColorStop(.5, `rgba(200,236,255,${a})`);
      g.addColorStop(1, "rgba(200,236,255,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }
    c.globalCompositeOperation = "destination-in";
    const m = c.createLinearGradient(0, H, 0, 0);
    m.addColorStop(0, "#000");
    m.addColorStop(.42, "rgba(0,0,0,.55)");
    m.addColorStop(.78, "rgba(0,0,0,.08)");
    m.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = m;
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = "source-over";
  }

  function shFrame(now) {
    const dt = Math.min(.05, (now - shLast) / 1000);
    shLast = now;
    shHv += (50 * ((shHot ? 1 : 0) - shHov) - 14 * shHv) * dt;
    shHov = shCl(shHov + shHv * dt, 0, 1.04);
    shGv += (-60 * shG - 6 * shGv) * dt;
    shG += shGv * dt;
    if (shDropT >= 0) {
      shDropT += dt * SH_SPEED;
      if (shDropT >= 2) shDropT = -1;
    }
    shDraw();
    const busy = shHot || shHov > .002 || shDropT >= 0 || Math.abs(shG) > .001 || Math.abs(shGv) > .01;
    if (busy || mn.dataset.s === "shelf") {
      shRaf = requestAnimationFrame(shFrame);
    } else {
      shRaf = 0;
    }
  }

  function shRun() {
    if (!shRaf) {
      shLast = performance.now();
      shRaf = requestAnimationFrame(shFrame);
    }
  }
  function shSetHot(on) { shHot = on; shRun(); }
  function shDropNow() { shHot = false; shDx = shCx; shDropT = 0; shGv = 7.7; shRun(); }

  /* ── 14. To-do Controller (Max 10 Tasks, Inline Add, Edit/Rename/Delete) ── */
  const todoRatioEl = document.querySelector(".js-todo-ratio");
  const todoAddBtn = document.querySelector(".js-todo-add");
  const todoEditBtn = document.querySelector(".js-todo-edit");
  const todoEditTxt = document.querySelector(".js-todo-edit-txt");
  const todoListEl = document.querySelector(".js-todo-list");
  const todoToast = document.querySelector(".js-todo-toast");

  const TODO_STORAGE_KEY = "winnotch_todo_items";
  const MAX_TODO_ITEMS = 10;
  let todoEditMode = false;
  let todoItems = [];

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function showTodoToast(msg) {
    if (!todoToast) return;
    todoToast.textContent = msg;
    todoToast.classList.add("show");
    setTimeout(() => todoToast.classList.remove("show"), 2200);
  }

  function saveTodos() {
    try {
      localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todoItems));
    } catch {}
  }

  function updateTodoCount() {
    const total = todoItems.length;
    const done = todoItems.filter((t) => t.done).length;
    if (todoRatioEl) {
      todoRatioEl.textContent = `${done}/${total}`;
    }
  }

  function startInlineRename(row, item) {
    const textSpan = row.querySelector(".trow-text");
    if (!textSpan) return;
    const currentVal = item.text;
    textSpan.innerHTML = `<input type="text" class="trow-edit-input" value="${escapeHtml(currentVal)}" maxlength="48" />`;
    const input = textSpan.querySelector(".trow-edit-input");
    input.focus();
    input.select();

    let committed = false;
    const commitRename = () => {
      if (committed) return;
      committed = true;
      const newText = input.value.trim();
      if (newText) {
        item.text = newText;
        saveTodos();
      }
      renderTodoList();
    };

    input.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        commitRename();
      } else if (evt.key === "Escape") {
        evt.preventDefault();
        committed = true;
        renderTodoList();
      }
    });

    input.addEventListener("blur", () => {
      setTimeout(commitRename, 100);
    });
  }

  function renderTodoList() {
    if (!todoListEl) return;
    todoListEl.innerHTML = "";

    todoItems.forEach((item) => {
      const row = document.createElement("div");
      row.className = `trow js-trow ${item.done ? "done" : ""}`;
      row.dataset.id = item.id;
      row.innerHTML = `
        <span class="chk"><svg viewBox="0 0 10 10"><path d="m2 5.2 2 2 4-4.4"></path></svg></span>
        <span class="trow-text"><s>${escapeHtml(item.text)}</s></span>
        <button type="button" class="trow-ren" title="Rename list">✎</button>
        <button type="button" class="trow-del" title="Hapus list">✕</button>
      `;

      // Toggle done when clicking check or text outside edit mode
      row.addEventListener("click", (e) => {
        if (todoEditMode) return;
        if (e.target.closest(".trow-ren, .trow-del")) return;
        item.done = !item.done;
        row.classList.toggle("done", item.done);
        saveTodos();
        updateTodoCount();
      });

      // Rename button
      const renBtn = row.querySelector(".trow-ren");
      renBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        startInlineRename(row, item);
      });

      // Delete button
      const delBtn = row.querySelector(".trow-del");
      delBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        row.style.transform = "scale(0.8) translateX(20px)";
        row.style.opacity = "0";
        setTimeout(() => {
          todoItems = todoItems.filter((t) => t.id !== item.id);
          saveTodos();
          renderTodoList();
        }, 160);
      });

      todoListEl.appendChild(row);
    });

    updateTodoCount();
  }

  // Add Task button
  todoAddBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (todoItems.length >= MAX_TODO_ITEMS) {
      showTodoToast("Maksimal 10 tugas!");
      return;
    }

    if (todoListEl.querySelector(".todo-add-row")) {
      todoListEl.querySelector(".todo-add-input")?.focus();
      return;
    }

    const addRow = document.createElement("div");
    addRow.className = "todo-add-row";
    addRow.innerHTML = `<input type="text" class="todo-add-input" placeholder="Tulis tugas baru & tekan Enter..." maxlength="48" />`;
    todoListEl.appendChild(addRow);
    todoListEl.scrollTop = todoListEl.scrollHeight;

    const input = addRow.querySelector(".todo-add-input");
    input.focus();

    let committed = false;
    const commitAdd = () => {
      if (committed) return;
      committed = true;
      const text = input.value.trim();
      addRow.remove();
      if (text) {
        if (todoItems.length >= MAX_TODO_ITEMS) {
          showTodoToast("Maksimal 10 tugas!");
          return;
        }
        todoItems.push({
          id: Date.now().toString(),
          text,
          done: false
        });
        saveTodos();
        renderTodoList();
      }
    };

    input.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        commitAdd();
      } else if (evt.key === "Escape") {
        evt.preventDefault();
        committed = true;
        addRow.remove();
      }
    });

    input.addEventListener("blur", () => {
      setTimeout(commitAdd, 120);
    });
  });

  // Edit Task button
  todoEditBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    todoEditMode = !todoEditMode;
    const todoEl = document.querySelector(".l-todo");
    if (todoEl) {
      todoEl.classList.toggle("editing", todoEditMode);
    }
    if (todoEditTxt) {
      todoEditTxt.textContent = todoEditMode ? "Done" : "Edit Task";
    }
  });

  // Init Todo items
  function initTodos() {
    try {
      const saved = localStorage.getItem(TODO_STORAGE_KEY);
      if (saved) {
        todoItems = JSON.parse(saved);
      }
    } catch {
      todoItems = [];
    }

    if (!todoItems || todoItems.length === 0) {
      todoItems = [
        { id: "1", text: "Design living notch for Windows", done: true },
        { id: "2", text: "Implement shelf drag and drop", done: true },
        { id: "3", text: "Polish smooth jelly animations", done: true }
      ];
    }

    renderTodoList();
  }
  initTodos();

  /* ── 14b. QuickNotes Controller (Physical .txt files, Editor & One-Way Drag) ── */
  const noteCountEl = document.querySelector(".js-note-count");
  const noteNewBtn = document.querySelector(".js-note-new");
  const noteEditBtn = document.querySelector(".js-note-edit");
  const noteEditTxt = document.querySelector(".js-note-edit-txt");
  const noteListEl = document.querySelector(".js-note-list");
  const noteEmptyEl = document.querySelector(".js-note-empty");
  const noteListView = document.querySelector(".js-note-list-view");
  const noteEditorView = document.querySelector(".js-note-editor-view");
  const noteFilenameInput = document.querySelector(".js-note-filename");
  const noteContentTextarea = document.querySelector(".js-note-content");
  const noteBackBtn = document.querySelector(".js-note-back");
  const noteSaveBtn = document.querySelector(".js-note-save");
  const noteToast = document.querySelector(".js-note-toast");
  const noteEl = document.querySelector(".l-note");

  const NOTE_STORAGE_KEY = "winnotch_browser_notes";
  let noteEditMode = false;
  let noteItems = [];
  let currentEditingNote = null; // null when creating new

  function showNoteToast(msg) {
    if (!noteToast) return;
    noteToast.textContent = msg;
    noteToast.classList.add("show");
    setTimeout(() => noteToast.classList.remove("show"), 2200);
  }

  // Load notes (from Electron disk via IPC or browser fallback)
  async function fetchNotes() {
    try {
      if (window.winNotch?.getNotes) {
        const loaded = await window.winNotch.getNotes();
        noteItems = Array.isArray(loaded) ? loaded : [];
      } else {
        const saved = localStorage.getItem(NOTE_STORAGE_KEY);
        if (saved) {
          noteItems = JSON.parse(saved);
        } else {
          noteItems = [
            {
              id: "Ideas.txt",
              name: "Ideas.txt",
              path: "C:\\Users\\WinNotch\\Ideas.txt",
              content: "Projek WinNotch Windows:\n- Dynamic Island styling\n- Smooth spring transitions\n- Quick notes drag-and-drop",
              updatedAt: Date.now() - 3600000,
              size: "105 B"
            },
            {
              id: "Meeting_Notes.txt",
              name: "Meeting_Notes.txt",
              path: "C:\\Users\\WinNotch\\Meeting_Notes.txt",
              content: "Meeting Agenda:\n1. Review UI designs\n2. Shelf file transfer\n3. Quick Notes integration",
              updatedAt: Date.now() - 7200000,
              size: "82 B"
            }
          ];
          localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify(noteItems));
        }
      }
    } catch (err) {
      console.warn("fetchNotes error:", err);
      noteItems = [];
    }
    renderNotesList();
  }

  function updateNotesCount() {
    if (noteCountEl) {
      noteCountEl.textContent = noteItems.length;
    }
    const sub = document.querySelector(".js-note-sub");
    if (sub) {
      sub.textContent = `${noteItems.length} Saved .txt ${noteItems.length === 1 ? "Note" : "Notes"}`;
    }
  }

  function startNoteInlineRename(row, note) {
    const nameEl = row.querySelector(".nt-name");
    if (!nameEl) return;
    const oldName = note.name;
    const baseName = oldName.replace(/\.txt$/i, "");
    nameEl.innerHTML = `<input type="text" class="nt-edit-input" value="${escapeHtml(baseName)}" maxlength="32" />`;
    const input = nameEl.querySelector(".nt-edit-input");
    input.focus();
    input.select();

    let committed = false;
    const commitRename = async () => {
      if (committed) return;
      committed = true;
      let newName = input.value.trim();
      if (!newName) newName = baseName;
      if (!newName.toLowerCase().endsWith(".txt")) newName += ".txt";

      if (newName !== oldName) {
        if (window.winNotch?.saveNote) {
          await window.winNotch.saveNote({
            oldName: oldName,
            name: newName,
            content: note.content
          });
        } else {
          note.name = newName;
          note.id = newName;
          localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify(noteItems));
        }
        showNoteToast(`Nama file diubah: "${newName}"`);
      }
      await fetchNotes();
    };

    input.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        commitRename();
      } else if (evt.key === "Escape") {
        evt.preventDefault();
        committed = true;
        renderNotesList();
      }
    });

    input.addEventListener("blur", () => {
      setTimeout(commitRename, 100);
    });
  }

  function renderNotesList() {
    if (!noteListEl) return;
    noteListEl.innerHTML = "";
    updateNotesCount();

    if (noteItems.length === 0) {
      if (noteEmptyEl) noteEmptyEl.style.display = "flex";
      return;
    }
    if (noteEmptyEl) noteEmptyEl.style.display = "none";

    noteItems.forEach((note) => {
      const row = document.createElement("div");
      row.className = "ntrow js-ntrow";
      row.dataset.id = note.id;
      row.dataset.filePath = note.path || "";
      row.draggable = true;
      row.title = "Drag ke folder/Desktop · Klik untuk buka/edit";

      // File preview snippet
      const snippet = (note.content || "").replace(/\s+/g, " ").trim().slice(0, 26) || (note.size || ".txt file");

      row.innerHTML = `
        <span class="nt-icon">
          <svg viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
        </span>
        <div class="nt-info">
          <span class="nt-name">${escapeHtml(note.name)}</span>
          <span class="nt-sub">${escapeHtml(snippet)}</span>
        </div>
        <button type="button" class="nt-ren" title="Ganti nama file">✎</button>
        <button type="button" class="nt-del" title="Hapus file note">✕</button>
      `;

      // Click row to open in editor
      row.addEventListener("click", (e) => {
        if (noteEditMode) return;
        if (e.target.closest(".nt-ren, .nt-del, .nt-edit-input")) return;
        openNoteEditor(note);
      });

      // Drag row OUT from notch to external folder/desktop (Strictly one-way)
      row.addEventListener("dragstart", (e) => {
        if (noteEditMode) {
          e.preventDefault();
          return;
        }
        const p = row.dataset.filePath;
        if (p && window.winNotch?.startDrag) {
          e.preventDefault();
          window.winNotch.startDrag({ file: p, id: note.id });
          showNoteToast(`Geser "${note.name}" ke folder tujuan`);
        } else {
          e.dataTransfer.setData("text/plain", note.content || "");
          e.dataTransfer.setData("DownloadURL", `text/plain:${note.name}:data:text/plain;charset=utf-8,${encodeURIComponent(note.content || "")}`);
        }
      });

      // Inline rename button
      const renBtn = row.querySelector(".nt-ren");
      renBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        startNoteInlineRename(row, note);
      });

      // Delete button
      const delBtn = row.querySelector(".nt-del");
      delBtn?.addEventListener("click", async (e) => {
        e.stopPropagation();
        row.style.transform = "scale(0.8) translateX(20px)";
        row.style.opacity = "0";
        setTimeout(async () => {
          if (window.winNotch?.deleteNote) {
            await window.winNotch.deleteNote(note.name || note.path);
          } else {
            noteItems = noteItems.filter((n) => n.id !== note.id);
            localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify(noteItems));
          }
          showNoteToast(`File "${note.name}" dihapus`);
          await fetchNotes();
        }, 160);
      });

      noteListEl.appendChild(row);
    });
  }

  // Open Editor
  function openNoteEditor(note) {
    currentEditingNote = note || null;
    if (noteListView) noteListView.style.display = "none";
    if (noteEditorView) noteEditorView.style.display = "flex";

    if (note) {
      if (noteFilenameInput) noteFilenameInput.value = note.name || "Untitled.txt";
      if (noteContentTextarea) noteContentTextarea.value = note.content || "";
    } else {
      // New note: auto-generate sequential filename
      let nextNum = 1;
      const existingNames = new Set(noteItems.map((n) => n.name.toLowerCase()));
      while (existingNames.has(`note_${nextNum}.txt`.toLowerCase())) {
        nextNum++;
      }
      if (noteFilenameInput) noteFilenameInput.value = `Note_${nextNum}.txt`;
      if (noteContentTextarea) {
        noteContentTextarea.value = "";
        setTimeout(() => noteContentTextarea.focus(), 60);
      }
    }
  }

  // Close Editor back to List
  function closeNoteEditor() {
    if (noteEditorView) noteEditorView.style.display = "none";
    if (noteListView) noteListView.style.display = "flex";
    currentEditingNote = null;
  }

  // Save Note logic
  async function saveNoteAction() {
    let filename = (noteFilenameInput?.value || "").trim();
    if (!filename) filename = "Untitled.txt";
    if (!filename.toLowerCase().endsWith(".txt")) filename += ".txt";
    filename = filename.replace(/[/\\?%*:|"<>]/g, "_");

    const content = noteContentTextarea?.value || "";
    const oldName = currentEditingNote ? currentEditingNote.name : null;

    if (window.winNotch?.saveNote) {
      const res = await window.winNotch.saveNote({
        oldName,
        name: filename,
        content
      });
      if (res && res.success) {
        showNoteToast(`Catatan "${filename}" berhasil disimpan!`);
      }
    } else {
      if (oldName) {
        noteItems = noteItems.filter((n) => n.name !== oldName);
      }
      noteItems.unshift({
        id: filename,
        name: filename,
        path: `C:\\Users\\WinNotch\\${filename}`,
        content,
        updatedAt: Date.now(),
        size: `${content.length} B`
      });
      localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify(noteItems));
      showNoteToast(`Catatan "${filename}" berhasil disimpan!`);
    }

    closeNoteEditor();
    await fetchNotes();
  }

  // Wire buttons in Note widget
  noteNewBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openNoteEditor(null);
  });

  noteEditBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    noteEditMode = !noteEditMode;
    if (noteEl) {
      noteEl.classList.toggle("editing", noteEditMode);
    }
    if (noteEditTxt) {
      noteEditTxt.textContent = noteEditMode ? "Done" : "Manage";
    }
  });

  noteBackBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeNoteEditor();
  });

  noteSaveBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    saveNoteAction();
  });

  // Ctrl+S inside textarea to quick save
  noteContentTextarea?.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveNoteAction();
    }
  });

  // When note filename is edited and user presses Enter
  noteFilenameInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      noteContentTextarea?.focus();
    }
  });

  // Initial fetch of notes
  fetchNotes();

  // Keyboard shortcut (Space) to toggle
  window.addEventListener("keydown", (e) => {
    if (e.key === " " && e.target === document.body) {
      e.preventDefault();
      if (mn.dataset.s === "idle") {
        isPinned = true;
        show("music");
      } else {
        isPinned = false;
        show("idle");
      }
    }
  });

  /* ── 15. Geser-Geser (Horizontal Swipe / Drag & Wheel Navigation) ── */
  const WIDGET_ORDER = ["music", "pomo", "water", "shelf", "todo", "note"];
  let swipeStartX = 0;
  let swipeStartY = 0;
  let isSwiping = false;
  let swipeDiffX = 0;
  let lastWheelTime = 0;

  function goToNextWidget() {
    const cur = mn.dataset.s;
    const idx = WIDGET_ORDER.indexOf(cur);
    if (idx !== -1) {
      const nextIdx = (idx + 1) % WIDGET_ORDER.length;
      show(WIDGET_ORDER[nextIdx]);
    } else {
      show("music");
    }
  }

  function goToPrevWidget() {
    const cur = mn.dataset.s;
    const idx = WIDGET_ORDER.indexOf(cur);
    if (idx !== -1) {
      const prevIdx = (idx - 1 + WIDGET_ORDER.length) % WIDGET_ORDER.length;
      show(WIDGET_ORDER[prevIdx]);
    } else {
      show("music");
    }
  }

  // Mouse drag to swipe / geser
  mn.addEventListener("mousedown", (e) => {
    if (mn.dataset.s === "idle") return;
    // Don't intercept clicks on buttons, inputs, textareas, pills, arrows, checkboxes, or file cards
    if (e.target.closest("button, input, textarea, .wbtn, .pill, .arw, .chk, .sh-clear, .pomo-reset-btn, .js-lyrics-btn, .ctl, .js-pomo-time, .w-gauge-container, .w-sub-dot, .dots i, .trow, .sh-card, .ntrow, .note-container")) {
      return;
    }
    swipeStartX = e.clientX;
    swipeStartY = e.clientY;
    isSwiping = true;
    swipeDiffX = 0;
  });

  window.addEventListener("mousemove", (e) => {
    if (!isSwiping) return;
    swipeDiffX = e.clientX - swipeStartX;
    if (Math.abs(swipeDiffX) > 8 && mn.dataset.s !== "idle") {
      const clamped = Math.max(-24, Math.min(24, swipeDiffX * 0.35));
      mn.style.transform = `translateX(calc(-50% + ${clamped}px))`;
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (!isSwiping) return;
    isSwiping = false;
    mn.style.transform = "";

    const diffY = e.clientY - swipeStartY;
    if (Math.abs(swipeDiffX) > 30 && Math.abs(swipeDiffX) > Math.abs(diffY)) {
      if (swipeDiffX < 0) {
        goToNextWidget();
      } else {
        goToPrevWidget();
      }
    }
  });

  // Touch & Precision Trackpad gesture swipe
  mn.addEventListener("touchstart", (e) => {
    if (mn.dataset.s === "idle" || e.touches.length !== 1) return;
    if (e.target.closest("button, input, textarea, .wbtn, .pill, .arw, .chk, .sh-clear, .pomo-reset-btn, .js-lyrics-btn, .ctl, .ntrow, .note-container")) return;
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
    isSwiping = true;
    swipeDiffX = 0;
  }, { passive: true });

  mn.addEventListener("touchmove", (e) => {
    if (!isSwiping || e.touches.length !== 1) return;
    swipeDiffX = e.touches[0].clientX - swipeStartX;
  }, { passive: true });

  mn.addEventListener("touchend", (e) => {
    if (!isSwiping) return;
    isSwiping = false;
    if (Math.abs(swipeDiffX) > 30) {
      if (swipeDiffX < 0) goToNextWidget();
      else goToPrevWidget();
    }
  });

  // Mouse Wheel / Trackpad 2-finger horizontal scroll to geser widgets
  mn.addEventListener("wheel", (e) => {
    if (mn.dataset.s === "idle" || mn.dataset.s === "lyrics") return;
    const now = performance.now();
    if (now - lastWheelTime < 380) return;

    if (Math.abs(e.deltaX) > 16) {
      e.preventDefault();
      lastWheelTime = now;
      if (e.deltaX > 0) goToNextWidget();
      else goToPrevWidget();
    } else if (Math.abs(e.deltaY) > 35 && (e.shiftKey || e.altKey)) {
      e.preventDefault();
      lastWheelTime = now;
      if (e.deltaY > 0) goToNextWidget();
      else goToPrevWidget();
    }
  }, { passive: false });

  /* ── 16. Dynamic HUD Pop-ups (Peripherals & Charging) ── */
  let hudTimer = null;
  let hudRevertState = "idle";

  // Native System Chimes (using shared getAudioContext & playTone)
  function playConnectChime() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      playTone(523.25, "sine", t, 0.12, 0.18);
      playTone(659.25, "sine", t + 0.08, 0.28, 0.22);
    } catch {}
  }

  // Chime: Device Disconnected (gentle descending 2-tone)
  function playDisconnectChime() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      playTone(587.33, "sine", t, 0.12, 0.16);
      playTone(440.00, "sine", t + 0.09, 0.28, 0.20);
    } catch {}
  }

  // Chime: Charger Connected (sparkling harmonic double tone)
  function playChargingChime() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      playTone(659.25, "sine", t, 0.14, 0.20);
      playTone(880.00, "sine", t + 0.09, 0.38, 0.25);
      playTone(1318.5, "sine", t + 0.12, 0.25, 0.08);
    } catch {}
  }

  // Chime: Charger Unplugged (soft downward tone)
  function playUnplugChime() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      playTone(523.25, "sine", t, 0.13, 0.16);
      playTone(392.00, "sine", t + 0.10, 0.28, 0.18);
    } catch {}
  }

  // Alarm: Low Battery Warning (urgent double attention beep)
  function playLowBatteryAlarm() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      playTone(783.99, "triangle", t, 0.09, 0.28);
      playTone(783.99, "triangle", t + 0.14, 0.16, 0.32);
    } catch {}
  }

  // HUD DOM Elements
  const btLayer = document.querySelector(".js-l-bt");
  const btRing = document.querySelector(".js-bt-ring");
  const btRingBg = document.querySelector(".js-bt-ring-bg");
  const btArc = document.querySelector(".js-bt-arc");
  const btSubWrap = document.querySelector(".js-bt-sub-wrap");
  const btName = document.querySelector(".js-bt-name");
  const btStatus = document.querySelector(".js-bt-status");
  const btBadgeGlow = document.querySelector(".js-bt-badge-glow");
  const btBadgeIcon = document.querySelector(".js-bt-badge-icon");
  const btMainSvg = document.querySelector(".js-bt-main-svg");

  const chLayer = document.querySelector(".js-l-charge");
  const chRing = document.querySelector(".js-ch-ring");
  const chRingBg = document.querySelector(".js-ch-ring-bg");
  const chArc = document.querySelector(".js-ch-arc");
  const chSubWrap = document.querySelector(".js-ch-sub-wrap");
  const chTitle = document.querySelector(".js-ch-title");
  const chStatus = document.querySelector(".js-ch-status");
  const chPct = document.querySelector(".js-ch-pct");

  // Dismiss HUD on click
  btLayer?.addEventListener("click", () => dismissHud());
  chLayer?.addEventListener("click", () => dismissHud());

  function dismissHud() {
    if (hudTimer) {
      clearTimeout(hudTimer);
      hudTimer = null;
    }
    mn.classList.remove("low-battery-pulse");
    const target = (hudRevertState && hudRevertState !== "bt" && hudRevertState !== "charge" && hudRevertState !== "msg") ? hudRevertState : "idle";
    show(target);
  }

  function triggerHud(targetState, durationMs = 3800) {
    if (hudTimer) {
      clearTimeout(hudTimer);
      hudTimer = null;
    }
    // Remember previous active widget if it wasn't a temporary HUD
    const curState = mn.dataset.s;
    if (curState !== "bt" && curState !== "charge" && curState !== "msg") {
      hudRevertState = curState || "idle";
    }

    show(targetState);

    hudTimer = setTimeout(() => {
      dismissHud();
    }, durationMs);
  }

  // Chime: Incoming Message (gentle ascending two-tone)
  function playMessageChime() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      playTone(659.25, "sine", t, 0.12, 0.18);
      playTone(880.00, "sine", t + 0.08, 0.22, 0.22);
      playTone(1046.5, "sine", t + 0.16, 0.30, 0.16);
    } catch {}
  }

  // SVG Icon definitions
  const DEVICE_ICONS = {
    headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H5a1 1 0 0 1-1-1zM20 15h-3v5h2a1 1 0 0 0 1-1z"></path>',
    mouse: '<rect x="6" y="3" width="12" height="18" rx="6" stroke-width="2"></rect><line x1="12" y1="7" x2="12" y2="11" stroke-width="2"></line>',
    keyboard: '<rect x="2" y="5" width="20" height="14" rx="2" stroke-width="2"></rect><line x1="6" y1="9" x2="6.01" y2="9" stroke-width="2"></line><line x1="10" y1="9" x2="10.01" y2="9" stroke-width="2"></line><line x1="14" y1="9" x2="14.01" y2="9" stroke-width="2"></line><line x1="18" y1="9" x2="18.01" y2="9" stroke-width="2"></line><line x1="6" y1="13" x2="6.01" y2="13" stroke-width="2"></line><line x1="18" y1="13" x2="18.01" y2="13" stroke-width="2"></line><line x1="8" y1="15" x2="16" y2="15" stroke-width="2"></line>',
    drive: '<path d="M6 3h12v7H6zm3-3v3m6-3v3M6 10v9a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-9z" stroke-width="2"></path>',
    speaker: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke-width="2"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke-width="2"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke-width="2"></path>',
    generic: '<circle cx="12" cy="12" r="10" stroke-width="2"></circle><line x1="12" y1="8" x2="12" y2="12" stroke-width="2"></line><line x1="12" y1="16" x2="12.01" y2="16" stroke-width="2"></line>'
  };

  const SUB_ICONS = {
    bluetooth: '<svg style="width:12px;height:12px" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m7 7 10 10-5 4V3l5 4L7 17"></path></svg>',
    cable: '<svg style="width:12px;height:12px" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6m-4 0h8v4a4 4 0 0 1-8 0v-4zm4 8v8"></path></svg>',
    usb: '<svg style="width:12px;height:12px" viewBox="0 0 24 24" fill="none" stroke="#ffc94d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1" fill="#ffc94d"></circle><path d="M12 22V5M12 12H7V8M12 14h5v-4"></path></svg>',
    disconnected: '<svg style="width:12px;height:12px" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
  };

  const DEVICE_COLORS = {
    headphones: { color: "#5ec2ff", bg: "#0d1a26" },
    mouse: { color: "#a78bfa", bg: "#1a1329" },
    keyboard: { color: "#34d399", bg: "#0d241a" },
    drive: { color: "#ffc94d", bg: "#261e0d" },
    speaker: { color: "#fb7185", bg: "#241118" },
    generic: { color: "#60a5fa", bg: "#0f172a" },
    disconnected: { color: "#f87171", bg: "#261012" }
  };

  function showDeviceHud(opts = {}) {
    if (!btLayer) return;
    const {
      action = "connect",
      deviceType = "headphones",
      name = "Peripheral",
      battery = null,
      isBluetooth = false,
      status = null
    } = opts;

    const isDiscon = action === "disconnect";
    const profile = isDiscon ? DEVICE_COLORS.disconnected : (DEVICE_COLORS[deviceType] || DEVICE_COLORS.generic);
    const mainSvgIcon = DEVICE_ICONS[deviceType] || DEVICE_ICONS.headphones;

    btLayer.classList.toggle("is-disconnected", isDiscon);
    if (btName) btName.textContent = name;
    if (btMainSvg) btMainSvg.innerHTML = mainSvgIcon;

    // Badge colors
    if (btBadgeIcon) {
      btBadgeIcon.style.background = profile.bg;
      btBadgeIcon.style.boxShadow = `inset 0 0 0 1.5px ${profile.color}88`;
    }
    if (btBadgeGlow) {
      btBadgeGlow.style.boxShadow = `0 0 0 1.5px ${profile.color}55, 0 0 0 6px ${profile.color}14`;
    }

    if (isDiscon) {
      // Disconnected state
      if (btStatus) btStatus.textContent = status || "Disconnected";
      if (btSubWrap) btSubWrap.innerHTML = SUB_ICONS.disconnected;
      if (btRing) btRing.classList.add("is-wired");
      playDisconnectChime();
    } else {
      // Connected state
      if (isBluetooth && battery !== null && battery !== undefined) {
        // Bluetooth with Battery percentage
        if (btStatus) btStatus.textContent = status || `Connected · ${battery}%`;
        if (btSubWrap) btSubWrap.innerHTML = SUB_ICONS.bluetooth;
        if (btRing) btRing.classList.remove("is-wired");

        // Arc offset calculation (Circumference = 69.1)
        const pct = Math.max(0, Math.min(100, Number(battery)));
        const offset = Math.max(0, Math.min(69.1, 69.1 * (1 - pct / 100)));
        if (btArc) {
          btArc.style.stroke = profile.color;
          btArc.style.strokeDashoffset = offset.toFixed(1);
        }
        if (btRingBg) btRingBg.style.stroke = "rgba(255,255,255,.22)";
      } else {
        // Wired cable / Flashdisk / Drive / No battery info: omit percentage
        if (btStatus) btStatus.textContent = status || "Connected";
        if (btSubWrap) {
          btSubWrap.innerHTML = (deviceType === "drive") ? SUB_ICONS.usb : (isBluetooth ? SUB_ICONS.bluetooth : SUB_ICONS.cable);
        }
        if (btRing) btRing.classList.add("is-wired");
      }
      playConnectChime();
    }

    triggerHud("bt", 3800);
  }

  function showChargingHud(opts = {}) {
    if (!chLayer) return;
    const {
      type = "charging",
      level = 70,
      threshold = 15
    } = opts;

    const numLevel = Math.max(0, Math.min(100, Number(level)));
    const offset = Math.max(0, Math.min(69.1, 69.1 * (1 - numLevel / 100)));

    chLayer.classList.remove("is-unplugged", "is-low-battery");
    mn.classList.remove("low-battery-pulse");

    if (type === "charging") {
      if (chTitle) chTitle.textContent = "Charging";
      if (chStatus) chStatus.textContent = "Charger connected";
      if (chPct) chPct.textContent = `${numLevel}%`;
      if (chArc) {
        chArc.style.stroke = "#33e07a";
        chArc.style.strokeDashoffset = offset.toFixed(1);
      }
      if (chRingBg) chRingBg.style.stroke = "rgba(51,224,122,.28)";
      if (chSubWrap) {
        chSubWrap.innerHTML = '<svg style="width:11px;height:13px" viewBox="0 0 10 14"><path d="M6 0 0 8h4l-1 6 6-8H5z" fill="#fff"></path></svg>';
      }
      playChargingChime();
      triggerHud("charge", 3800);
    } else if (type === "unplugged") {
      chLayer.classList.add("is-unplugged");
      if (chTitle) chTitle.textContent = "Discharging";
      if (chStatus) chStatus.textContent = "Charger disconnected";
      if (chPct) chPct.textContent = `${numLevel}%`;
      if (chArc) {
        chArc.style.stroke = "#ffc94d";
        chArc.style.strokeDashoffset = offset.toFixed(1);
      }
      if (chRingBg) chRingBg.style.stroke = "rgba(255,201,77,.25)";
      if (chSubWrap) {
        chSubWrap.innerHTML = '<svg style="width:11px;height:13px" viewBox="0 0 10 14"><path d="M6 0 0 8h4l-1 6 6-8H5z" fill="#ffc94d"></path></svg>';
      }
      playUnplugChime();
      triggerHud("charge", 3800);
    } else if (type === "low-battery") {
      chLayer.classList.add("is-low-battery");
      mn.classList.add("low-battery-pulse");
      const title = threshold <= 5 ? "Battery Reserve" : (threshold <= 10 ? "Battery Critical" : "Battery Low");
      if (chTitle) chTitle.textContent = title;
      if (chStatus) chStatus.textContent = "Please connect charger";
      if (chPct) chPct.textContent = `${numLevel}%`;
      if (chArc) {
        chArc.style.stroke = "#ff4b55";
        chArc.style.strokeDashoffset = offset.toFixed(1);
      }
      if (chRingBg) chRingBg.style.stroke = "rgba(255,75,85,.35)";
      if (chSubWrap) {
        chSubWrap.innerHTML = '<svg style="width:12px;height:12px" viewBox="0 0 24 24" fill="none" stroke="#ff4b55" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
      }
      playLowBatteryAlarm();
      triggerHud("charge", 4600);
    }
  }

  // Incoming Message HUD DOM Elements
  const msgLayer = document.querySelector(".js-l-msg");
  const msgRingBg = document.querySelector(".js-msg-ring-bg");
  const msgArc = document.querySelector(".js-msg-arc");
  const msgAppIcon = document.querySelector(".js-msg-app-icon");
  const msgSender = document.querySelector(".js-msg-sender");
  const msgAppTag = document.querySelector(".js-msg-app-tag");
  const msgText = document.querySelector(".js-msg-text");
  const msgHiddenText = document.querySelector(".js-msg-hidden-text");
  const msgTogglePrivacyBtn = document.querySelector(".js-msg-toggle-privacy");
  const msgDismissBtn = document.querySelector(".js-msg-dismiss");

  // Privacy State: whether message text is masked
  let isMessagePrivacyHidden = localStorage.getItem("winnotch_msg_privacy") === "true";

  function updateMessagePrivacyUI() {
    if (!msgLayer) return;
    msgLayer.classList.toggle("is-privacy-hidden", isMessagePrivacyHidden);
  }
  updateMessagePrivacyUI();

  msgTogglePrivacyBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    isMessagePrivacyHidden = !isMessagePrivacyHidden;
    localStorage.setItem("winnotch_msg_privacy", isMessagePrivacyHidden ? "true" : "false");
    updateMessagePrivacyUI();
  });

  msgDismissBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    dismissHud();
  });

  msgLayer?.addEventListener("click", (e) => {
    if (e.target.closest(".msg-action-btn")) return;
    dismissHud();
  });

  const APP_PROFILES = {
    whatsapp: {
      name: "WhatsApp",
      color: "#25D366",
      bg: "rgba(37, 211, 102, 0.22)",
      border: "rgba(37, 211, 102, 0.45)",
      icon: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>'
    },
    telegram: {
      name: "Telegram",
      color: "#229ED9",
      bg: "rgba(34, 158, 217, 0.22)",
      border: "rgba(34, 158, 217, 0.45)",
      icon: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path>'
    },
    discord: {
      name: "Discord",
      color: "#5865F2",
      bg: "rgba(88, 101, 242, 0.22)",
      border: "rgba(88, 101, 242, 0.45)",
      icon: '<rect x="2" y="6" width="20" height="12" rx="4"></rect><path d="M6 12h4m-2-2v4m9-2h.01m3 0h.01"></path>'
    },
    generic: {
      name: "Pesan",
      color: "#818cf8",
      bg: "rgba(129, 140, 248, 0.22)",
      border: "rgba(129, 140, 248, 0.45)",
      icon: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>'
    }
  };

  function showMessageHud(opts = {}) {
    if (!msgLayer) return;
    const {
      app = "whatsapp",
      sender = "Dina",
      text = "Bro, filenya udah ku kirim ya"
    } = opts;

    const lowerApp = (app || "").toLowerCase();
    let profile = APP_PROFILES.generic;
    if (lowerApp.includes("wa") || lowerApp.includes("whatsapp")) profile = APP_PROFILES.whatsapp;
    else if (lowerApp.includes("tele") || lowerApp.includes("tg")) profile = APP_PROFILES.telegram;
    else if (lowerApp.includes("disc") || lowerApp.includes("dc")) profile = APP_PROFILES.discord;

    if (msgSender) msgSender.textContent = sender || "Seseorang";
    if (msgText) msgText.textContent = text || "Pesan baru masuk";
    if (msgAppTag) {
      msgAppTag.textContent = profile.name;
      msgAppTag.style.color = profile.color;
      msgAppTag.style.background = profile.bg;
      msgAppTag.style.borderColor = profile.border;
    }
    if (msgArc) {
      msgArc.style.stroke = profile.color;
      msgArc.style.strokeDashoffset = "0";
    }
    if (msgRingBg) {
      msgRingBg.style.stroke = profile.bg;
    }
    if (msgAppIcon) {
      msgAppIcon.innerHTML = profile.icon;
      msgAppIcon.style.stroke = profile.color;
    }

    updateMessagePrivacyUI();
    playMessageChime();
    triggerHud("msg", 4800);
  }

  // Listen to IPC HUD events from Electron main process
  window.winNotch?.onHudEvent?.((evt) => {
    if (!evt) return;
    if (evt.type === "device") {
      showDeviceHud(evt);
    } else if (evt.type === "charging" || evt.type === "unplugged" || evt.type === "low-battery") {
      showChargingHud(evt);
    } else if (evt.type === "message" || evt.type === "msg") {
      showMessageHud(evt);
    }
  });

  // Global test function for console & browser testing
  window.testHud = (scenario, customData) => {
    switch (scenario) {
      case "msg-wa":
        showMessageHud({
          app: "whatsapp",
          sender: "Dina",
          text: customData?.text || "Bro, filenya udah ku kirim ya. Tolong dicek ya!",
          ...customData
        });
        break;
      case "msg-tg":
        showMessageHud({
          app: "telegram",
          sender: "Alex",
          text: customData?.text || "Fitur living notch sudah siap dirilis ke GitHub!",
          ...customData
        });
        break;
      case "msg-dc":
        showMessageHud({
          app: "discord",
          sender: "Gaming Guild",
          text: customData?.text || "Mabar yuk! Slot lobby tersisa 1 orang lagi nih.",
          ...customData
        });
        break;
      case "headphones-bt":
        showDeviceHud({
          name: "AirBuds Pro",
          action: "connect",
          deviceType: "headphones",
          battery: 70,
          isBluetooth: true,
          ...customData
        });
        break;
      case "headphones-wired":
        showDeviceHud({
          name: "Studio Headphones",
          action: "connect",
          deviceType: "headphones",
          isBluetooth: false,
          ...customData
        });
        break;
      case "usb-connect":
        showDeviceHud({
          name: "SanDisk 32GB (E:)",
          action: "connect",
          deviceType: "drive",
          isBluetooth: false,
          status: "Storage connected",
          ...customData
        });
        break;
      case "harddisk-connect":
        showDeviceHud({
          name: "Backup Plus 2TB (F:)",
          action: "connect",
          deviceType: "drive",
          isBluetooth: false,
          status: "External Drive connected",
          ...customData
        });
        break;
      case "mouse-bt":
        showDeviceHud({
          name: "Logitech G Pro",
          action: "connect",
          deviceType: "mouse",
          battery: 85,
          isBluetooth: true,
          ...customData
        });
        break;
      case "keyboard-bt":
        showDeviceHud({
          name: "Keychron K2",
          action: "connect",
          deviceType: "keyboard",
          battery: 90,
          isBluetooth: true,
          ...customData
        });
        break;
      case "keyboard-wired":
        showDeviceHud({
          name: "Mechanical Keyboard",
          action: "connect",
          deviceType: "keyboard",
          isBluetooth: false,
          ...customData
        });
        break;
      case "speaker-bt":
        showDeviceHud({
          name: "JBL Flip 6",
          action: "connect",
          deviceType: "speaker",
          battery: 60,
          isBluetooth: true,
          ...customData
        });
        break;
      case "device-disconnect":
        showDeviceHud({
          name: customData?.name || "AirBuds Pro",
          action: "disconnect",
          deviceType: customData?.deviceType || "headphones",
          isBluetooth: true,
          status: "Disconnected",
          ...customData
        });
        break;
      case "charging":
        showChargingHud({
          type: "charging",
          level: customData?.level ?? 85,
          ...customData
        });
        break;
      case "unplugged":
        showChargingHud({
          type: "unplugged",
          level: customData?.level ?? 85,
          ...customData
        });
        break;
      case "low-15":
        showChargingHud({
          type: "low-battery",
          level: 15,
          threshold: 15,
          ...customData
        });
        break;
      case "low-10":
        showChargingHud({
          type: "low-battery",
          level: 10,
          threshold: 10,
          ...customData
        });
        break;
      case "low-5":
        showChargingHud({
          type: "low-battery",
          level: 5,
          threshold: 5,
          ...customData
        });
        break;
      default:
        console.log("Usage: window.testHud('headphones-bt' | 'headphones-wired' | 'usb-connect' | 'harddisk-connect' | 'mouse-bt' | 'keyboard-bt' | 'speaker-bt' | 'device-disconnect' | 'charging' | 'unplugged' | 'low-15' | 'low-10' | 'low-5')");
        break;
    }
  };
})();
