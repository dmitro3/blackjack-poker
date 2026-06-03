/* ============================================================
   GILDED — Texas Hold'em engine (vanilla, global: window.Poker)
   Hand evaluation + no-limit betting state machine + simple AI
   ============================================================ */
(function (w) {
  'use strict';

  var VAL = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
  var CAT_NAMES = ['High Card','Pair','Two Pair','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush'];

  /* ---- best 5-of-7 evaluation ---- */
  function straightHigh(vals) {
    var s = {}; vals.forEach(function (v) { s[v] = 1; });
    if (s[14]) s[1] = 1; // wheel
    var run = 0, high = 0;
    for (var v = 14; v >= 1; v--) {
      if (s[v]) { run++; if (run >= 5 && high === 0) high = v + 4; }
      else run = 0;
    }
    return high; // 0 if none; else top card of straight
  }

  function evaluate(cards) {
    var vals = cards.map(function (c) { return VAL[c.rank]; });
    var bySuit = {}; cards.forEach(function (c) { (bySuit[c.suit] = bySuit[c.suit] || []).push(VAL[c.rank]); });
    var counts = {}; vals.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
    var uniqDesc = Object.keys(counts).map(Number).sort(function (a, b) { return b - a; });

    // flush
    var flushSuit = null;
    Object.keys(bySuit).forEach(function (s) { if (bySuit[s].length >= 5) flushSuit = s; });

    // straight flush
    if (flushSuit) {
      var sfHigh = straightHigh(bySuit[flushSuit]);
      if (sfHigh) return [8, sfHigh];
    }
    // quads
    var quad = uniqDesc.find(function (v) { return counts[v] === 4; });
    if (quad) { var k = uniqDesc.filter(function (v) { return v !== quad; })[0]; return [7, quad, k]; }
    // full house
    var trips = uniqDesc.filter(function (v) { return counts[v] === 3; });
    var pairs = uniqDesc.filter(function (v) { return counts[v] === 2; });
    if (trips.length >= 1 && (trips.length >= 2 || pairs.length >= 1)) {
      var t = trips[0], p = trips.length >= 2 ? trips[1] : pairs[0];
      return [6, t, p];
    }
    // flush
    if (flushSuit) { var f = bySuit[flushSuit].slice().sort(function (a, b) { return b - a; }).slice(0, 5); return [5].concat(f); }
    // straight
    var sh = straightHigh(vals);
    if (sh) return [4, sh];
    // trips
    if (trips.length) { var tk = uniqDesc.filter(function (v) { return v !== trips[0]; }).slice(0, 2); return [3, trips[0]].concat(tk); }
    // two pair
    if (pairs.length >= 2) { var kk = uniqDesc.filter(function (v) { return v !== pairs[0] && v !== pairs[1]; })[0]; return [2, pairs[0], pairs[1], kk]; }
    // pair
    if (pairs.length === 1) { var pk = uniqDesc.filter(function (v) { return v !== pairs[0]; }).slice(0, 3); return [1, pairs[0]].concat(pk); }
    // high
    return [0].concat(uniqDesc.slice(0, 5));
  }
  function cmp(a, b) { for (var i = 0; i < Math.max(a.length, b.length); i++) { var x = a[i] || 0, y = b[i] || 0; if (x !== y) return x - y; } return 0; }
  function rankName(score) { return CAT_NAMES[score[0]]; }

  /* ---- simple AI hand strength 0..1 ---- */
  function preflopStrength(hole) {
    var a = VAL[hole[0].rank], b = VAL[hole[1].rank];
    var hi = Math.max(a, b), lo = Math.min(a, b);
    var suited = hole[0].suit === hole[1].suit;
    var s = 0;
    if (a === b) s = 0.5 + (hi / 14) * 0.45;            // pair
    else { s = (hi / 14) * 0.34 + (lo / 14) * 0.16; if (suited) s += 0.08; if (hi - lo <= 2) s += 0.06; }
    return Math.max(0, Math.min(1, s));
  }
  function postStrength(hole, board) {
    var sc = evaluate(hole.concat(board));
    var base = sc[0] / 8; // category fraction
    // small kicker bonus
    return Math.max(0, Math.min(1, base + (sc[1] || 0) / 200));
  }
  function strength(p, board) {
    return board.length === 0 ? preflopStrength(p.hole) : postStrength(p.hole, board);
  }

  w.PokerEval = { evaluate: evaluate, cmp: cmp, rankName: rankName, strength: strength, VAL: VAL };
})(window);
