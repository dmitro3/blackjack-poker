/* ============================================================
   GILDED — shared bank + deck + helpers (vanilla, global)
   ============================================================ */
(function (w) {
  'use strict';

  var KEY = 'gilded_chips_v1';
  var START = 100000;
  var ROOM_KEY = 'gilded_room_v1';

  /* ---------- chip bank (localStorage, cross-tab) ---------- */
  function getBalance() {
    var v = parseInt(localStorage.getItem(KEY), 10);
    if (isNaN(v)) { v = START; localStorage.setItem(KEY, v); }
    return v;
  }
  function setBalance(v) {
    v = Math.max(0, Math.round(v));
    localStorage.setItem(KEY, v);
    w.dispatchEvent(new CustomEvent('balancechange', { detail: v }));
    return v;
  }
  function adjust(delta) { return setBalance(getBalance() + delta); }
  function resetBalance() { return setBalance(START); }

  // keep tabs in sync
  w.addEventListener('storage', function (e) {
    if (e.key === KEY) w.dispatchEvent(new CustomEvent('balancechange', { detail: getBalance() }));
  });

  /* ---------- formatting ---------- */
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function fmtShort(n) {
    n = Number(n);
    if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1) + 'K';
    return '' + n;
  }

  /* ---------- room / invite ---------- */
  function makeCode() {
    var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }
  function getRoom() {
    var url = new URLSearchParams(location.search).get('room');
    if (url) return url.toUpperCase();
    var r = localStorage.getItem(ROOM_KEY);
    if (!r) { r = makeCode(); localStorage.setItem(ROOM_KEY, r); }
    return r;
  }
  function inviteUrl(page, code) {
    var base = location.href.split('?')[0];
    if (page) base = base.replace(/[^/]*$/, page);
    return base + '?room=' + (code || getRoom());
  }

  /* ---------- deck ---------- */
  var SUITS = [
    { s: '♠', c: 'black', n: 'S' },
    { s: '♥', c: 'red', n: 'H' },
    { s: '♦', c: 'red', n: 'D' },
    { s: '♣', c: 'black', n: 'C' }
  ];
  var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  function freshDeck() {
    var d = [];
    for (var si = 0; si < SUITS.length; si++)
      for (var ri = 0; ri < RANKS.length; ri++)
        d.push({ rank: RANKS[ri], suit: SUITS[si].s, color: SUITS[si].c, code: RANKS[ri] + SUITS[si].n });
    return d;
  }
  function shuffle(d) {
    for (var i = d.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = d[i]; d[i] = d[j]; d[j] = t;
    }
    return d;
  }

  /* ---------- card HTML ---------- */
  function cardHTML(card, opts) {
    opts = opts || {};
    if (!card || opts.back) {
      return '<div class="card back' + (opts.cls ? ' ' + opts.cls : '') + '"' + (opts.style ? ' style="' + opts.style + '"' : '') + '></div>';
    }
    var red = card.color === 'red' ? ' red' : '';
    return '' +
      '<div class="card' + red + (opts.cls ? ' ' + opts.cls : '') + '"' + (opts.style ? ' style="' + opts.style + '"' : '') + '>' +
        '<div class="pip-tl"><div class="rank">' + card.rank + '</div><div class="pip-suit">' + card.suit + '</div></div>' +
        '<div class="center-suit">' + card.suit + '</div>' +
        '<div class="pip-br"><div class="rank">' + card.rank + '</div><div class="pip-suit">' + card.suit + '</div></div>' +
      '</div>';
  }

  /* ---------- blackjack value ---------- */
  function handValue(cards) {
    var total = 0, aces = 0;
    cards.forEach(function (c) {
      if (c.rank === 'A') { aces++; total += 11; }
      else if (['K', 'Q', 'J', '10'].indexOf(c.rank) >= 0) total += 10;
      else total += parseInt(c.rank, 10);
    });
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return { total: total, soft: aces > 0 };
  }

  /* ---------- toast ---------- */
  function toast(msg, kind) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:38px;transform:translateX(-50%) translateY(20px);' +
      'z-index:9999;padding:13px 26px;border-radius:999px;font-family:Cinzel,serif;font-weight:600;' +
      'letter-spacing:.05em;opacity:0;transition:all .35s cubic-bezier(.2,.8,.2,1);pointer-events:none;' +
      'box-shadow:0 14px 40px rgba(0,0,0,.5);border:1px solid rgba(217,182,90,.5);';
    if (kind === 'win') { t.style.background = 'linear-gradient(160deg,#f3dd96,#d9b65a,#9c7b2e)'; t.style.color = '#2a1f08'; }
    else if (kind === 'lose') { t.style.background = 'linear-gradient(160deg,#6a1325,#440b18)'; t.style.color = '#f4ecd8'; }
    else { t.style.background = 'linear-gradient(180deg,#241f15,#0b0a07)'; t.style.color = '#f4ecd8'; }
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
    setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(20px)'; setTimeout(function () { t.remove(); }, 400); }, kind === 'win' || kind === 'lose' ? 2200 : 1700);
  }

  /* ---------- mount a live balance pill ---------- */
  function mountBalance(el) {
    function render() {
      el.innerHTML = '<span class="coin">H</span><span class="amt tabnum">' + fmt(getBalance()) + '</span>';
    }
    el.classList.add('balance');
    render();
    w.addEventListener('balancechange', render);
    return render;
  }

  w.Bank = {
    getBalance: getBalance, setBalance: setBalance, adjust: adjust, resetBalance: resetBalance,
    fmt: fmt, fmtShort: fmtShort, START: START,
    makeCode: makeCode, getRoom: getRoom, inviteUrl: inviteUrl,
    freshDeck: freshDeck, shuffle: shuffle, cardHTML: cardHTML, handValue: handValue,
    toast: toast, mountBalance: mountBalance,
    SUITS: SUITS, RANKS: RANKS
  };
})(window);
