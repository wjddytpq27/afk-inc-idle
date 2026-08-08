/* AFK 주식회사 — idle money machine. Vanilla JS, DOM-based, no deps. */
(() => {
  "use strict";

  // ── Locale (English default; Korean when the browser or a saved pref says so) ──
  const LANG_KEY = "afkinc_lang";
  function resolveLang() {
    try {
      const s = localStorage.getItem(LANG_KEY);
      if (s === "en" || s === "ko") return s;
    } catch (_) {
      /* storage blocked */
    }
    const n = (navigator.language || "en").toLowerCase();
    return n.startsWith("ko") ? "ko" : "en";
  }
  const LANG = resolveLang();
  const L = (window.AFK_T && window.AFK_T[LANG]) || (window.AFK_T && window.AFK_T.en) || {};
  const CUR = L.cur || "$";

  // ── Generator definitions (icons/economy; names come from the locale) ──
  const GEN = [
    { icon: "🧑‍💻", baseCost: 10,      rate: 1 },
    { icon: "🤖", baseCost: 120,     rate: 9 },
    { icon: "🕷️", baseCost: 1400,    rate: 55 },
    { icon: "📈", baseCost: 15000,   rate: 320 },
    { icon: "🏭", baseCost: 170000,  rate: 1800 },
    { icon: "🧠", baseCost: 2000000, rate: 10500 },
    { icon: "🗄️", baseCost: 26000000, rate: 62000 },
    { icon: "🚀", baseCost: 380000000, rate: 380000 },
    { icon: "🏢", baseCost: 5500000000, rate: 2400000 },
    { icon: "🌌", baseCost: 82000000000, rate: 16000000 },
    { icon: "🌐", baseCost: 1200000000000, rate: 110000000 },
    { icon: "⏳", baseCost: 18000000000000, rate: 720000000 },
  ];
  const genName = (i) => (L.gen && L.gen[i]) || "";
  const COST_MULT = 1.15;
  const MILESTONES = [10, 25, 50, 100, 150, 200, 300, 400, 500, 750, 1000];
  const SAVE_KEY = "afkinc_save_v1";
  const OFFLINE_CAP = 8 * 3600; // seconds
  const OFFLINE_EFF = 0.5;

  // ── State ──────────────────────────────────────────────────
  const state = {
    money: 0,
    earned: 0, // this-run earnings (for prestige calc)
    lifetimeEarned: 0, // never resets — drives HQ tower growth
    prestigeCount: 0,
    pp: 0, // prestige coins
    clickLevel: 1,
    buyMode: "1",
    gens: GEN.map(() => ({ owned: 0, revealed: false })),
    lastSave: Date.now(),
    muted: false,
    achieved: [], // one-time achievement ids
    up: { click: 0, income: 0, offline: 0 }, // money upgrades (reset on prestige)
    autobuy: false, // unlocked once, persists through prestige
    autobuyOn: true,
    onboarded: false, // first-session guided loop shown?
  };

  // ── Upgrade definitions (labels come from the locale; val → display value) ──
  const UPGRADES = [
    { id: "click", icon: "👆", max: 12, cost: (l) => 800 * Math.pow(7, l), val: (l) => fmt(Math.pow(2, l)) },
    { id: "income", icon: "⚡", max: 20, cost: (l) => 5000 * Math.pow(11, l), val: (l) => Math.pow(1.6, l).toFixed(2) },
    { id: "offline", icon: "😴", max: 5, cost: (l) => 20000 * Math.pow(14, l), val: (l) => Math.round((0.5 + 0.1 * l) * 100) },
  ];
  const upName = (id) => (L.up && L.up[id] && L.up[id].name) || id;
  const upFmt = (id, v) => (L.up && L.up[id] ? L.up[id].fmt(v) : String(v));
  const AUTOBUY_COST = 1000000;

  // ── Rewarded-ad boost (native idle monetization) ───────────
  const BOOST_MS = 60000; // 2× income for 60s per rewarded ad
  let boostUntil = 0; // runtime only — not saved (no boost carries across reload)
  let lastOfflineGain = 0; // pending offline gain, doublable via rewarded ad
  let sdkMuted = false; // CrazyGames site-level mute (overrides in-game audio)
  function boostActive() {
    return Date.now() < boostUntil;
  }

  // ── Math helpers ───────────────────────────────────────────
  const SUF = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  function fmt(n) {
    if (n < 1000) return (Math.floor(n * 10) / 10).toString().replace(/\.0$/, "");
    const t = Math.floor(Math.log10(n) / 3);
    if (t < SUF.length) {
      const s = n / Math.pow(1000, t);
      return (Math.floor(s * 100) / 100) + SUF[t];
    }
    return n.toExponential(2);
  }

  function milestoneMult(owned) {
    let m = 1;
    for (const t of MILESTONES) if (owned >= t) m *= 2;
    return m;
  }
  function globalMult() {
    return (1 + 0.02 * state.pp) * Math.pow(1.6, state.up.income) * (boostActive() ? 2 : 1);
  }
  function clickValue() {
    return Math.pow(2, state.up.click) * globalMult();
  }
  function offlineEff() {
    return Math.min(1, 0.5 + 0.1 * state.up.offline);
  }
  function genRate(i) {
    const g = state.gens[i];
    return g.owned * GEN[i].rate * milestoneMult(g.owned) * globalMult();
  }
  function totalRate() {
    let r = 0;
    for (let i = 0; i < GEN.length; i++) r += genRate(i);
    return r;
  }

  function costOf(i, n) {
    const owned = state.gens[i].owned;
    const base = GEN[i].baseCost * Math.pow(COST_MULT, owned);
    return (base * (Math.pow(COST_MULT, n) - 1)) / (COST_MULT - 1);
  }
  function maxBuy(i) {
    const owned = state.gens[i].owned;
    const base = GEN[i].baseCost * Math.pow(COST_MULT, owned);
    const val = (state.money * (COST_MULT - 1)) / base + 1;
    if (val <= 1) return 0;
    return Math.max(0, Math.floor(Math.log(val) / Math.log(COST_MULT)));
  }
  function buyQty(i) {
    if (state.buyMode === "max") return maxBuy(i);
    return Number(state.buyMode);
  }

  function prestigePotential() {
    return Math.floor(Math.sqrt(state.earned / 1e9));
  }

  // ── Juice: sound (synthesized), toasts, particles ──────────
  const Sfx = {
    ctx: null,
    init() {
      if (!this.ctx) {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (AC) this.ctx = new AC();
        } catch (_) {
          /* audio unavailable — game still works silent */
        }
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    },
    tone(freq, dur, type, gain) {
      if (state.muted || sdkMuted || !this.ctx) return; // SDK mute wins
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(gain || 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t);
      o.stop(t + dur);
    },
    click() {
      this.tone(300 + Math.random() * 60, 0.06, "triangle", 0.04);
    },
    buy() {
      this.tone(520, 0.08, "square", 0.05);
      this.tone(790, 0.12, "square", 0.035);
    },
    milestone() {
      [660, 880, 1180].forEach((f, i) =>
        setTimeout(() => this.tone(f, 0.16, "sine", 0.06), i * 70),
      );
    },
    prestige() {
      [440, 660, 880, 1320].forEach((f, i) =>
        setTimeout(() => this.tone(f, 0.24, "sine", 0.07), i * 90),
      );
    },
  };

  // ── Ads: thin wrapper over the CrazyGames SDK ──────────────
  // On CrazyGames → real video ads. On localhost → SDK shows a placeholder.
  // Anywhere else (Vercel/GitHub) the SDK is "disabled", so we fall back to
  // granting the reward directly — the game (and its boosts) always work.
  const Ads = {
    sdk: null,
    ready: false,
    busy: false,
    async init() {
      try {
        const SDK = window.CrazyGames && window.CrazyGames.SDK;
        if (SDK && typeof SDK.init === "function") {
          await SDK.init();
          this.sdk = SDK;
          this.ready = SDK.environment !== "disabled";
          // Respect the CrazyGames site-level mute setting (required).
          if (this.ready && SDK.game) {
            try {
              sdkMuted = !!(SDK.game.settings && SDK.game.settings.muteAudio);
              if (typeof SDK.game.addSettingsChangeListener === "function") {
                SDK.game.addSettingsChangeListener(() => {
                  try {
                    sdkMuted = !!SDK.game.settings.muteAudio;
                  } catch (_) {
                    /* ignore */
                  }
                });
              }
            } catch (_) {
              /* settings unavailable — in-game mute still works */
            }
          }
        }
      } catch (_) {
        this.ready = false; // SDK missing/blocked — fallbacks handle it
      }
    },
    // Portal rule: on a real ad network, grant the reward ONLY when the ad
    // finishes — never on error/no-fill/adblock (opts.onFail handles those).
    // Off-portal (SDK disabled → not monetized) the boost is just a free
    // feature, so we grant immediately. Either way the game is fully playable
    // without ads, so adblock users are never punished.
    rewarded(onReward, opts) {
      opts = opts || {};
      if (this.busy) return;
      if (this.ready && this.sdk && this.sdk.ad) {
        this.busy = true;
        const wasMuted = state.muted;
        let done = false;
        const restore = () => {
          this.busy = false;
          state.muted = wasMuted;
        };
        const call = (fn) => {
          try {
            fn && fn();
          } catch (_) {
            /* handler must never crash the game */
          }
        };
        try {
          this.sdk.ad.requestAd("rewarded", {
            adStarted: () => {
              state.muted = true; // silence game during the ad
              call(opts.onStart);
            },
            adFinished: () => {
              if (done) return;
              done = true;
              restore();
              call(onReward);
            },
            adError: () => {
              // No ad available (Basic Launch / adblock / no-fill) → still grant
              // this optional reward so the feature always works. Real ads show
              // and earn once the game is promoted to Full Launch.
              if (done) return;
              done = true;
              restore();
              call(onReward);
            },
          });
          return;
        } catch (_) {
          this.busy = false;
        }
      }
      call2(onReward); // no portal ads here — grant immediately
      function call2(fn) {
        try {
          fn && fn();
        } catch (_) {
          /* ignore */
        }
      }
    },
    interstitial() {
      if (!(this.ready && this.sdk && this.sdk.ad)) return;
      const wasMuted = state.muted;
      try {
        this.sdk.ad.requestAd("midgame", {
          adStarted: () => {
            state.muted = true;
          },
          adFinished: () => {
            state.muted = wasMuted;
          },
          adError: () => {
            state.muted = wasMuted;
          },
        });
      } catch (_) {
        /* ignore — ads are best-effort */
      }
    },
  };

  function toast(text, icon) {
    const box = document.getElementById("toasts");
    if (!box) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = '<span class="ic"></span><span class="tx"></span>';
    el.querySelector(".ic").textContent = icon || "🏆";
    el.querySelector(".tx").textContent = text;
    box.appendChild(el);
    setTimeout(() => el.remove(), 2900);
  }

  function coinBurst(x, y) {
    for (let i = 0; i < 6; i++) {
      const c = document.createElement("span");
      c.className = "coin";
      c.textContent = "💰";
      c.style.left = x + "px";
      c.style.top = y + "px";
      c.style.setProperty("--dx", (Math.random() - 0.5) * 90 + "px");
      c.style.setProperty("--dy", -(Math.random() * 60 + 30) + "px");
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 700);
    }
  }

  function achieve(id, text, icon) {
    if (state.achieved.includes(id)) return;
    state.achieved.push(id);
    toast(text, icon);
  }
  function checkMoneyAchievements() {
    if (state.lifetimeEarned >= 1e6) achieve("m1", L.tM1, "💵");
    if (state.lifetimeEarned >= 1e9) achieve("m1b", L.tM1b, "🤑");
    if (state.lifetimeEarned >= 1e12) achieve("m1t", L.tM1t, "👑");
    if (state.lifetimeEarned >= 1e15) achieve("m1q", L.tM1q, "🌟");
    const tb = totalBots();
    if (tb >= 50) achieve("b50", L.tB50, "🤖");
    if (tb >= 200) achieve("b200", L.tB200, "🏭");
    if (tb >= 500) achieve("b500", L.tB500, "🌌");
  }

  // ── Actions ────────────────────────────────────────────────
  function addMoney(v) {
    state.money += v;
    state.earned += v;
    state.lifetimeEarned += v;
  }
  function totalBots() {
    let n = 0;
    for (const g of state.gens) n += g.owned;
    return n;
  }

  function doClick(e) {
    Sfx.init();
    const v = clickValue();
    addMoney(v);
    spawnFloat(e, "+" + CUR + fmt(v));
    Sfx.click();
    moneyEl.classList.remove("pop");
    void moneyEl.offsetWidth; // restart animation
    moneyEl.classList.add("pop");
  }

  function buy(i) {
    Sfx.init();
    const n = buyQty(i);
    if (n <= 0) return;
    const cost = costOf(i, n);
    if (state.money < cost) return;
    const before = milestoneMult(state.gens[i].owned);
    state.money -= cost;
    state.gens[i].owned += n;
    const after = milestoneMult(state.gens[i].owned);

    Sfx.buy();
    const r = cards[i].el.getBoundingClientRect();
    coinBurst(r.left + 30, r.top + r.height / 2);
    cards[i].el.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.03)" }, { transform: "scale(1)" }],
      { duration: 180, easing: "ease-out" },
    );
    achieve("first_bot", L.tFirstBot, "🤖");

    if (after > before) {
      cards[i].el.classList.remove("flash");
      void cards[i].el.offsetWidth;
      cards[i].el.classList.add("flash");
      Sfx.milestone();
      toast(L.tGenX2(genName(i)), "✨");
    }
  }

  function prestige() {
    const gain = prestigePotential();
    if (gain <= 0) return;
    if (!confirm(L.confirmPrestige(gain))) return;
    state.pp += gain;
    state.prestigeCount = (state.prestigeCount || 0) + 1;
    state.money = 0;
    state.earned = 0;
    state.clickLevel = 1;
    state.gens = GEN.map(() => ({ owned: 0, revealed: false }));
    state.up = { click: 0, income: 0, offline: 0 };
    Sfx.prestige();
    toast(L.tPrestige(state.pp), "🌌");
    achieve("p1", L.tPrestige1, "🌌");
    if (state.prestigeCount >= 5) achieve("p5", L.tPrestige5, "✨");
    save();
    Ads.interstitial(); // natural break — show a midgame ad
  }

  function buyUp(u) {
    const lvl = state.up[u.id];
    if (lvl >= u.max) return;
    const cost = u.cost(lvl);
    if (state.money < cost) return;
    state.money -= cost;
    state.up[u.id] = lvl + 1;
    Sfx.milestone();
    toast(L.tUpgraded(upName(u.id), lvl + 1), u.icon);
    if (lvl + 1 >= u.max) achieve("max_" + u.id, L.tUpMaxed(upName(u.id)), "⭐");
  }

  function buyAutobuy() {
    if (state.autobuy || state.money < AUTOBUY_COST) return;
    state.money -= AUTOBUY_COST;
    state.autobuy = true;
    state.autobuyOn = true;
    Sfx.milestone();
    toast(L.tAutobuyOn, "⚙️");
    achieve("autobuy", L.tAutobuyAch, "⚙️");
  }

  function runAutobuy() {
    if (!state.autobuy || !state.autobuyOn) return;
    let guard = 0;
    while (guard++ < 3) {
      let best = -1,
        bestCost = Infinity;
      for (let i = 0; i < GEN.length; i++) {
        if (!state.gens[i].revealed) continue;
        const c = costOf(i, 1);
        if (c <= state.money && c < bestCost) {
          bestCost = c;
          best = i;
        }
      }
      if (best < 0) break;
      state.money -= bestCost;
      state.gens[best].owned += 1;
    }
  }

  // ── Save / load / offline ──────────────────────────────────
  function save() {
    state.lastSave = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (_) {
      /* storage may be unavailable (private mode) — ignore */
    }
  }
  function load() {
    let raw;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch (_) {
      return;
    }
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      Object.assign(state, s);
      // guard against shape drift
      if (!Array.isArray(state.gens) || state.gens.length !== GEN.length) {
        state.gens = GEN.map(() => ({ owned: 0, revealed: false }));
      }
      if (!Array.isArray(state.achieved)) state.achieved = [];
      if (typeof state.muted !== "boolean") state.muted = false;
      if (!state.up || typeof state.up !== "object")
        state.up = { click: 0, income: 0, offline: 0 };
      state.up.click = state.up.click || 0;
      state.up.income = state.up.income || 0;
      state.up.offline = state.up.offline || 0;
      if (typeof state.autobuy !== "boolean") state.autobuy = false;
      if (typeof state.autobuyOn !== "boolean") state.autobuyOn = true;
      if (typeof state.onboarded !== "boolean") state.onboarded = false;
      if (typeof state.lifetimeEarned !== "number")
        state.lifetimeEarned = state.earned || 0;
      if (typeof state.prestigeCount !== "number") state.prestigeCount = 0;
    } catch (_) {
      /* corrupt save — start fresh */
    }
  }
  function applyOffline() {
    const dt = Math.min(OFFLINE_CAP, (Date.now() - state.lastSave) / 1000);
    if (dt < 5) return;
    const gain = totalRate() * dt * offlineEff();
    if (gain <= 0) return;
    addMoney(gain);
    lastOfflineGain = gain; // doublable via rewarded ad
    offlineEarnedEl.textContent = CUR + fmt(gain);
    const mins = Math.floor(dt / 60);
    offlineTextEl.textContent = L.offlineText(mins, Math.round(offlineEff() * 100));
    if (offlineDoubleBtn) offlineDoubleBtn.classList.remove("hidden");
    offlineModal.classList.remove("hidden");
  }

  // ── DOM refs ───────────────────────────────────────────────
  const moneyEl = document.getElementById("money");
  const persecEl = document.getElementById("persec");
  const clickBtn = document.getElementById("clicker");
  const clickValEl = document.getElementById("clickval");
  const gensEl = document.getElementById("gens");
  const ppOwnedEl = document.getElementById("ppOwned");
  const prestigeBtn = document.getElementById("prestigeBtn");
  const prestigeInfo = document.getElementById("prestigeInfo");
  const offlineModal = document.getElementById("offlineModal");
  const offlineEarnedEl = document.getElementById("offlineEarned");
  const offlineTextEl = document.getElementById("offlineText");
  const cards = [];
  const upsEl = document.getElementById("ups");
  const upCards = [];
  let autobuyCard = null;
  const towerEl = document.getElementById("tower");
  const titleEl = document.getElementById("title");
  const startBtn = document.getElementById("startBtn");
  const titleNoteEl = document.getElementById("titleNote");
  const boostBtn = document.getElementById("boostBtn");
  const boostBar = document.getElementById("boostBar");
  const boostLabelEl = document.getElementById("boostLabel");
  const boostProgEl = document.getElementById("boostProg");
  const offlineDoubleBtn = document.getElementById("offlineDoubleBtn");

  function spawnFloat(e, text) {
    const f = document.createElement("span");
    f.className = "float";
    f.textContent = text;
    const wrap = clickBtn.parentElement;
    const rect = wrap.getBoundingClientRect();
    const x = (e && e.clientX ? e.clientX : rect.left + rect.width / 2) - rect.left;
    const y = (e && e.clientY ? e.clientY : rect.top + rect.height / 2) - rect.top;
    f.style.left = x - 20 + "px";
    f.style.top = y - 10 + "px";
    wrap.appendChild(f);
    setTimeout(() => f.remove(), 800);
  }

  function buildCards() {
    GEN.forEach((g, i) => {
      const el = document.createElement("div");
      el.className = "gen locked";
      el.innerHTML = `
        <div class="icon">${g.icon}</div>
        <div class="info">
          <div class="name"></div>
          <div class="meta"></div>
          <div class="prog"><span></span></div>
        </div>
        <div class="buy">
          <div class="owned num">0</div>
          <div class="cost num"></div>
        </div>`;
      el.querySelector(".name").textContent = genName(i);
      el.addEventListener("click", () => buy(i));
      gensEl.appendChild(el);
      cards.push({
        el,
        name: el.querySelector(".name"),
        meta: el.querySelector(".meta"),
        prog: el.querySelector(".prog > span"),
        owned: el.querySelector(".owned"),
        cost: el.querySelector(".cost"),
      });
    });
  }

  function upCardMarkup(icon, name) {
    return (
      `<div class="icon">${icon}</div>` +
      `<div class="info"><div class="name">${name}</div><div class="meta"></div></div>` +
      `<div class="buy"><div class="owned num"></div><div class="cost num"></div></div>`
    );
  }

  function buildUps() {
    UPGRADES.forEach((u) => {
      const el = document.createElement("div");
      el.className = "gen up";
      el.innerHTML = upCardMarkup(u.icon, upName(u.id));
      el.addEventListener("click", () => buyUp(u));
      upsEl.appendChild(el);
      upCards.push({
        el,
        meta: el.querySelector(".meta"),
        owned: el.querySelector(".owned"),
        cost: el.querySelector(".cost"),
      });
    });
    const el = document.createElement("div");
    el.className = "gen up";
    el.innerHTML = upCardMarkup("⚙️", L.autobuyName);
    el.addEventListener("click", () => {
      if (!state.autobuy) buyAutobuy();
      else {
        state.autobuyOn = !state.autobuyOn;
        save();
      }
    });
    upsEl.appendChild(el);
    autobuyCard = {
      el,
      meta: el.querySelector(".meta"),
      owned: el.querySelector(".owned"),
      cost: el.querySelector(".cost"),
    };
  }

  function renderUps() {
    UPGRADES.forEach((u, i) => {
      const c = upCards[i];
      const lvl = state.up[u.id];
      const maxed = lvl >= u.max;
      const cur = upFmt(u.id, u.val(lvl));
      c.meta.textContent = maxed ? cur : `${cur} → ${upFmt(u.id, u.val(lvl + 1))}`;
      c.owned.textContent = "Lv." + lvl + (maxed ? "" : "/" + u.max);
      if (maxed) {
        c.cost.textContent = "MAX";
        c.el.classList.add("maxed");
        c.el.classList.remove("afford");
      } else {
        const cost = u.cost(lvl);
        c.cost.textContent = CUR + fmt(cost);
        c.el.classList.toggle("afford", state.money >= cost);
        c.el.classList.remove("maxed");
      }
    });
    const a = autobuyCard;
    if (!state.autobuy) {
      a.meta.textContent = L.autobuyMetaBuy;
      a.owned.textContent = "";
      a.cost.textContent = CUR + fmt(AUTOBUY_COST);
      a.el.classList.toggle("afford", state.money >= AUTOBUY_COST);
      a.el.classList.remove("maxed");
    } else {
      a.meta.textContent = state.autobuyOn ? L.autobuyMetaOn : L.autobuyMetaOff;
      a.owned.textContent = state.autobuyOn ? "ON" : "OFF";
      a.cost.textContent = state.autobuyOn ? L.autobuyTapOff : L.autobuyTapOn;
      a.el.classList.remove("afford");
      a.el.classList.add("maxed");
    }
  }

  // ── Business evolution diorama (grows with net worth) ──────
  // Each stage = a whole scene: sky gradient, CSS skyline, emoji props.
  const STAGES = [
    { min: 0,       name: "돗자리 장사",   sky: ["#bfe3ff", "#eaf6ff"], ground: "#caa46a", night: false, props: "🧺", people: "🧍", n: 1, tone: 30 },
    { min: 1e3,     name: "포장마차",      sky: ["#ffd39b", "#ffb27a"], ground: "#9c7b4a", night: false, props: "🏮", people: "🧍🧍", n: 2, tone: 20 },
    { min: 5e4,     name: "골목 가게",     sky: ["#ffb27a", "#ff8f6b"], ground: "#7a6a52", night: false, props: "🏪", people: "🧍🚶", n: 3, tone: 35 },
    { min: 5e6,     name: "첫 사무실",     sky: ["#8497d9", "#b7a0d4"], ground: "#4a5270", night: false, props: "🏢", people: "🚶💼", n: 4, tone: 210 },
    { min: 5e8,     name: "본사 사옥",     sky: ["#3f4a86", "#7a5da8"], ground: "#333a5c", night: true,  props: "🏢🏢", people: "🚗💼", n: 6, tone: 220 },
    { min: 5e10,    name: "대기업 캠퍼스", sky: ["#242a55", "#4a3a72"], ground: "#232848", night: true,  props: "🏙️", people: "🚗🚕", n: 8, tone: 235 },
    { min: 5e12,    name: "계열사 그룹",   sky: ["#1a1f45", "#3a2a63"], ground: "#1a1f3a", night: true,  props: "🏙️🏢", people: "🚕✈️", n: 11, tone: 255 },
    { min: 5e14,    name: "글로벌 제국",   sky: ["#141838", "#2a1f55"], ground: "#141733", night: true,  props: "🌆", people: "✈️🛫", n: 14, tone: 280 },
    { min: 5e16,    name: "우주 진출",     sky: ["#0a0e28", "#1a1040"], ground: "#0d1130", night: true,  props: "🚀🛰️", people: "🛸", n: 16, tone: 200, space: true },
    { min: 5e18,    name: "특이점 문명",   sky: ["#060818", "#180a35"], ground: "#0a0c22", night: true,  props: "🌌🪐", people: "🛸👽", n: 18, tone: 290, space: true },
  ];
  function stageIndex() {
    let idx = 0;
    for (let i = 0; i < STAGES.length; i++) if (state.lifetimeEarned >= STAGES[i].min) idx = i;
    return idx;
  }
  let renderedStage = -1;
  let renderedDetail = -1;

  function renderScene() {
    if (!towerEl) return;
    const si = stageIndex();
    const st = STAGES[si];
    // detail level within a stage grows with number of bots (liveliness)
    const detail = Math.min(6, Math.floor(totalBots() / 12));
    if (si === renderedStage && detail === renderedDetail) return;
    const grew = renderedStage >= 0 && si > renderedStage;
    renderedStage = si;
    renderedDetail = detail;

    const wrap = towerEl.parentElement;
    if (wrap) wrap.style.background = `linear-gradient(180deg, ${st.sky[0]}, ${st.sky[1]})`;

    // Skyline: fills the full width; height scales up with the era so early
    // stages read as a low townscape and late stages as a tall metropolis.
    const count = Math.min(16, 7 + si);
    const eraScale = si <= 2 ? 0.5 : si <= 4 ? 0.72 : si <= 6 ? 0.88 : 1;
    let buildings = "";
    for (let i = 0; i < count; i++) {
      const seed = (i * 37 + si * 13) % 100;
      const h = Math.max(24, Math.round((44 + (seed % 52)) * eraScale)); // % of band
      const grow = (7 + (seed % 8)) / 10; // slight width variance
      const L = st.night ? 20 + (seed % 12) : 40 + (seed % 14);
      const bg = `hsl(${st.tone + (seed % 25)} ${st.night ? 42 : 26}% ${L}%)`;
      const roof = `hsl(${st.tone + (seed % 25)} ${st.night ? 42 : 26}% ${L + 7}%)`;
      let wins = "";
      const rows = Math.max(1, Math.round(h / 14));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 3; c++) {
          const on = st.night ? (seed + r * 3 + c) % 3 !== 0 : (seed + r + c) % 4 === 0;
          wins += `<i class="w${on ? " on" : ""}"></i>`;
        }
      }
      buildings += `<div class="bld" style="height:${h}%;flex-grow:${grow};background:linear-gradient(180deg,${roof},${bg})"><div class="wins">${wins}</div></div>`;
    }

    // Foreground props: a lively row standing ON the ground (grows w/ detail).
    const propCount = Math.min(7, 3 + detail);
    let props = "";
    for (let i = 0; i < propCount; i++) {
      const emoji = i % 2 === 0 ? st.props : st.people;
      const delay = ((i % 4) * 0.35).toFixed(2);
      props += `<span class="prop" style="animation-delay:${delay}s">${emoji}</span>`;
    }

    // Sky: sun + drifting clouds (day) · moon + stars (night) · stars (space).
    let sky;
    if (st.space) {
      sky = '<div class="stars">✦ ·· ✧ · ✦ ·· ✧ ·· ✦ · ✧ ·· ✦ · ✧</div><span class="moon">🪐</span>';
    } else if (st.night) {
      sky = '<div class="stars dim">· ✦ ·· · ✦ ·· ✦ · ·· ✦ ·· ✦ ·</div><span class="moon">🌙</span>';
    } else {
      sky = '<span class="sun">☀️</span><span class="cloud c1">☁️</span><span class="cloud c2">☁️</span>';
    }

    towerEl.innerHTML =
      sky +
      `<div class="skyline">${buildings}</div>` +
      `<div class="ground" style="background:${st.ground}"></div>` +
      `<div class="fg">${props}</div>` +
      `<div class="scene-label">${L.stage[si]}</div>`;

    if (grew) {
      toast(L.tBizGrew(L.stage[si]), st.props.slice(0, 2));
      Sfx.milestone();
      if (si >= 5) achieve("biz_corp", L.tBizCorp, "🏙️");
      if (si >= 8) achieve("biz_space", L.tBizSpace, "🚀");
    }
  }

  // ── Render ─────────────────────────────────────────────────
  function nextMilestone(owned) {
    for (const t of MILESTONES) if (owned < t) return t;
    return null;
  }

  function render() {
    moneyEl.textContent = fmt(state.money);
    persecEl.textContent = L.perSec(fmt(totalRate()));
    clickValEl.textContent = L.perTap(fmt(clickValue()));
    ppOwnedEl.textContent = L.coins(state.pp);

    const pot = prestigePotential();
    prestigeBtn.disabled = pot <= 0;
    prestigeBtn.textContent = pot > 0 ? L.prestigeBtnReady(pot) : L.prestigeBtnLocked;
    prestigeInfo.textContent =
      pot > 0 ? L.prestigeInfoReady(pot) : L.prestigeInfoLocked(state.pp, CUR + fmt(1e9));

    for (let i = 0; i < GEN.length; i++) {
      const g = state.gens[i];
      const c = cards[i];
      const prevOwned = i === 0 ? 1 : state.gens[i - 1].owned;
      if (!g.revealed && (g.owned > 0 || state.money >= GEN[i].baseCost * 0.5 || prevOwned > 0)) {
        g.revealed = true;
        if (i > 0) toast(L.revealToast(genName(i)), GEN[i].icon);
      }

      if (!g.revealed) {
        c.el.classList.add("locked");
        c.owned.textContent = "🔒";
        c.cost.textContent = CUR + fmt(GEN[i].baseCost);
        c.meta.textContent = L.locked;
        c.prog.style.width = "0%";
        continue;
      }
      c.el.classList.remove("locked");

      const n = buyQty(i);
      const cost = costOf(i, Math.max(1, n));
      const afford = n > 0 && state.money >= cost;
      c.el.classList.toggle("afford", afford);

      c.owned.textContent = g.owned;
      c.cost.textContent = (n > 1 ? `×${n}  ` : "") + CUR + fmt(cost);
      c.meta.textContent = L.genMeta(fmt(genRate(i)), fmt(GEN[i].rate));

      const nm = nextMilestone(g.owned);
      if (nm) {
        const prev = MILESTONES.filter((t) => t <= g.owned).pop() || 0;
        const p = ((g.owned - prev) / (nm - prev)) * 100;
        c.prog.style.width = Math.max(0, Math.min(100, p)) + "%";
        c.meta.textContent += L.genNext(g.owned, nm);
      } else {
        c.prog.style.width = "100%";
      }
    }

    renderUps();
    renderBoost();
    renderScene();
  }

  function renderBoost() {
    if (!boostBtn || !boostBar) return;
    if (boostActive()) {
      const remain = boostUntil - Date.now();
      boostBtn.classList.add("hidden");
      boostBar.classList.remove("hidden");
      if (boostLabelEl) boostLabelEl.textContent = L.boostActive(Math.ceil(remain / 1000));
      if (boostProgEl) boostProgEl.style.width = Math.max(0, (remain / BOOST_MS) * 100) + "%";
    } else {
      boostBtn.classList.remove("hidden");
      boostBar.classList.add("hidden");
    }
  }

  // ── Onboarding: curated forced loop (tap → buy → automate) ─
  // Research-backed: teach the core verb by forcing it once, no text wall.
  // Everything but the current target is dimmed & non-interactive.
  const Onboard = {
    active: false,
    step: 0,
    finger: null,
    refs: null,
    start() {
      if (state.onboarded || state.lifetimeEarned > 0) return;
      this.refs = {
        coach: document.getElementById("coach"),
        text: document.getElementById("coachText"),
        hud: document.querySelector(".hud"),
        scene: document.querySelector(".scene-wrap"),
        clickerWrap: document.querySelector(".clicker-wrap"),
        clicker: document.getElementById("clicker"),
        boostBtn: document.getElementById("boostBtn"),
        boostBar: document.getElementById("boostBar"),
        buymode: document.querySelector(".buymode"),
        gensPanel: document.getElementById("gensPanel"),
        upsPanel: document.getElementById("upsPanel"),
        prestige: document.querySelector(".prestige-panel"),
        foot: document.querySelector(".foot"),
        firstGen: cards[0] && cards[0].el,
      };
      if (!this.refs.coach) return;
      this.active = true;
      this.refs.coach.classList.remove("hidden");
      const skip = document.getElementById("coachSkip");
      if (skip) skip.addEventListener("click", () => this.finish(), { once: true });
      this.toStep(1);
    },
    dim(list) {
      list.forEach((el) => el && el.classList.add("coach-dim"));
    },
    putFinger(target, emoji) {
      if (!target) return;
      const f = document.createElement("span");
      f.className = "coach-finger";
      f.textContent = emoji || "👆";
      target.appendChild(f);
      this.finger = f;
    },
    clearMarks() {
      const r = this.refs;
      if (!r) return;
      [r.hud, r.scene, r.clickerWrap, r.clicker, r.boostBtn, r.boostBar, r.buymode, r.gensPanel, r.upsPanel, r.prestige, r.foot, r.firstGen].forEach(
        (el) => el && el.classList.remove("coach-dim", "coach-focus"),
      );
      if (this.finger && this.finger.parentNode) this.finger.parentNode.removeChild(this.finger);
      this.finger = null;
    },
    toStep(n) {
      this.clearMarks();
      const r = this.refs;
      this.step = n;
      if (n === 1) {
        this.dim([r.hud, r.scene, r.boostBtn, r.boostBar, r.buymode, r.gensPanel, r.upsPanel, r.prestige, r.foot]);
        if (r.clicker) r.clicker.classList.add("coach-focus");
        this.putFinger(r.clicker, "👆");
        r.text.textContent = L.coach1;
      } else if (n === 2) {
        this.dim([r.hud, r.scene, r.clickerWrap, r.boostBtn, r.boostBar, r.buymode, r.upsPanel, r.prestige, r.foot]);
        if (r.firstGen) {
          r.firstGen.classList.add("coach-focus");
          this.putFinger(r.firstGen, "👆");
          r.firstGen.scrollIntoView({ block: "center" });
        }
        r.text.textContent = L.coach2;
      } else if (n === 3) {
        r.text.textContent = L.coach3;
        setTimeout(() => this.finish(), 3800);
      }
    },
    tick() {
      if (!this.active) return;
      if (this.step === 1 && state.money >= GEN[0].baseCost) this.toStep(2);
      else if (this.step === 2 && state.gens[0].owned >= 1) this.toStep(3);
    },
    finish() {
      if (!this.active) return;
      this.active = false;
      this.clearMarks();
      if (this.refs && this.refs.coach) this.refs.coach.classList.add("hidden");
      state.onboarded = true;
      save();
    },
  };

  // ── Loop ───────────────────────────────────────────────────
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (state.money >= 0) addMoney(totalRate() * dt);
    runAutobuy();
    checkMoneyAchievements();
    Onboard.tick();
    render();
    requestAnimationFrame(frame);
  }

  // ── Wire up ────────────────────────────────────────────────
  clickBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    doClick(e);
  });
  // Keyboard accessibility (Enter/Space on the focused clicker) — the button's
  // native click fires on key press; pointer taps use pointerdown, so no dupes.
  clickBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      doClick(e);
    }
  });
  prestigeBtn.addEventListener("click", prestige);
  document.getElementById("offlineOk").addEventListener("click", () => {
    lastOfflineGain = 0;
    offlineModal.classList.add("hidden");
  });

  if (boostBtn) {
    boostBtn.addEventListener("click", () => {
      if (boostActive()) return;
      Sfx.init();
      Ads.rewarded(() => {
        boostUntil = Date.now() + BOOST_MS;
        Sfx.milestone();
        toast(L.tBoostOn, "🔥");
        renderBoost();
      });
    });
  }

  if (offlineDoubleBtn) {
    offlineDoubleBtn.addEventListener("click", () => {
      if (lastOfflineGain <= 0) return;
      Sfx.init();
      const bonus = lastOfflineGain; // grant the same amount again → 2×
      lastOfflineGain = 0;
      offlineDoubleBtn.classList.add("hidden");
      Ads.rewarded(() => {
        addMoney(bonus);
        Sfx.milestone();
        toast(L.tOfflineDoubled(fmt(bonus)), "💰");
        offlineModal.classList.add("hidden");
      });
    });
  }

  const muteBtn = document.getElementById("mute");
  function renderMute() {
    muteBtn.textContent = state.muted ? "🔇" : "🔊";
    muteBtn.classList.toggle("off", state.muted);
  }
  muteBtn.addEventListener("click", () => {
    state.muted = !state.muted;
    renderMute();
    if (!state.muted) Sfx.init();
    save();
  });
  window.addEventListener("pointerdown", () => Sfx.init(), { once: true });

  let started = false;
  function startGame() {
    if (started) return;
    started = true;
    Sfx.init();
    if (titleEl) titleEl.classList.add("hidden");
    applyOffline(); // grant + show "돌아온 사이 벌었어요" after entering
    Onboard.start(); // first-session guided loop (no-op for returning players)
  }
  if (startBtn) startBtn.addEventListener("click", startGame);
  document.querySelectorAll(".buymode button").forEach((b) => {
    b.addEventListener("click", () => {
      state.buyMode = b.dataset.mode;
      document.querySelectorAll(".buymode button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
    });
  });

  // Populate all static [data-t] strings from the active locale.
  function applyStaticText() {
    document.documentElement.lang = LANG;
    document.querySelectorAll("[data-t]").forEach((el) => {
      const v = L[el.dataset.t];
      if (v != null) el.innerHTML = v;
    });
  }

  // Language toggle — persist choice, save progress, reload with new locale.
  const langBtn = document.getElementById("langBtn");
  if (langBtn) {
    langBtn.textContent = LANG === "en" ? "한" : "EN";
    langBtn.addEventListener("click", () => {
      try {
        localStorage.setItem(LANG_KEY, LANG === "en" ? "ko" : "en");
      } catch (_) {
        /* storage blocked — ignore */
      }
      save();
      location.reload();
    });
  }

  // ── Boot ───────────────────────────────────────────────────
  Ads.init(); // async, non-blocking — enables real ads on CrazyGames
  load();
  applyStaticText();
  buildCards();
  buildUps();
  // restore buy-mode UI
  document.querySelectorAll(".buymode button").forEach((b) => {
    b.classList.toggle("on", b.dataset.mode === state.buyMode);
  });
  renderMute();
  // Title screen: continue vs new. Offline earnings are granted on Start.
  if (startBtn) {
    if (state.lifetimeEarned > 0) {
      startBtn.textContent = L.startContinue;
      titleNoteEl.textContent = L.noteContinue(fmt(state.money), state.pp);
    } else {
      startBtn.textContent = L.startNew;
      titleNoteEl.textContent = L.noteNew;
    }
  }
  render();
  setInterval(save, 5000);
  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) save();
  });
  requestAnimationFrame(frame);
})();
