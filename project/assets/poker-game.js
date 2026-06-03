/* ============================================================
   GILDED — Texas Hold'em game state machine (window.PokerGame)
   ============================================================ */
(function (w) {
  'use strict';
  var SB = 500, BB = 1000, BOT_BUYIN = 120000;
  var EV = w.PokerEval;

  function PokerGame(names) {
    // seat 0 = you (bottom). Others are house bots (replaceable by invited friends).
    this.players = names.map(function (n, i) {
      return { id: i, name: n.name, isYou: i === 0, isBot: i !== 0, avatar: n.avatar,
        stack: i === 0 ? Bank.getBalance() : BOT_BUYIN,
        hole: [], bet: 0, totalIn: 0, folded: false, allIn: false, acted: false, lastAct: '', sittingOut: false, won: 0 };
    });
    this.button = Math.floor(Math.random() * this.players.length);
    this.community = [];
    this.pot = 0; this.currentBet = 0; this.lastRaise = BB; this.toAct = -1;
    this.street = 'idle'; // idle|preflop|flop|turn|river|showdown|handover
    this.deck = []; this.raisesThisStreet = 0; this.lastResult = null; this.message = '';
    this.handNo = 0;
  }
  var P = PokerGame.prototype;

  P.syncBank = function () { var you = this.players[0]; Bank.setBalance(you.stack); };

  P.alive = function () { return this.players.filter(function (p) { return !p.folded && !p.sittingOut; }); };
  P.canAct = function () { return this.players.filter(function (p) { return !p.folded && !p.allIn && !p.sittingOut; }); };

  P.startHand = function () {
    var self = this;
    // re-buy / sit out
    this.players.forEach(function (p) {
      if (p.isYou) { p.stack = Bank.getBalance(); p.sittingOut = p.stack < BB; }
      else { if (p.stack < BB) p.stack = BOT_BUYIN; p.sittingOut = false; }
      p.hole = []; p.bet = 0; p.totalIn = 0; p.folded = false; p.allIn = false; p.acted = false; p.lastAct = ''; p.won = 0;
    });
    if (this.alive().length < 2) { this.street = 'idle'; this.message = 'Need chips to play — refill to deal in.'; return; }
    this.handNo++;
    this.community = []; this.pot = 0; this.currentBet = 0; this.lastRaise = BB; this.raisesThisStreet = 1; this.lastResult = null;
    this.deck = Bank.shuffle(Bank.freshDeck());
    // advance button to a seated player
    do { this.button = (this.button + 1) % this.players.length; } while (this.players[this.button].sittingOut);

    var order = this.seatedOrderFrom(this.button + 1);
    // blinds
    var sb = order[0], bb = order[1 % order.length];
    this.commit(sb, Math.min(SB, sb.stack)); sb.lastAct = 'SB';
    this.commit(bb, Math.min(BB, bb.stack)); bb.lastAct = 'BB';
    this.currentBet = BB;
    // deal 2 each
    for (var r = 0; r < 2; r++) for (var i = 0; i < order.length; i++) order[i].hole.push(this.deck.pop());
    this.players.forEach(function (p) { p.acted = false; });
    this.street = 'preflop';
    // first to act = player after BB
    this.toAct = this.nextIndex(this.players.indexOf(bb));
    this.message = '';
    this.syncBank();
  };

  P.seatedOrderFrom = function (start) {
    var arr = [];
    for (var i = 0; i < this.players.length; i++) {
      var idx = (start + i) % this.players.length;
      if (!this.players[idx].sittingOut) arr.push(this.players[idx]);
    }
    return arr;
  };

  P.commit = function (p, amt) {
    amt = Math.min(amt, p.stack);
    p.stack -= amt; p.bet += amt; p.totalIn += amt; this.pot += amt;
    if (p.stack === 0) p.allIn = true;
    if (p.isYou) this.syncBank();
  };

  P.needToAct = function (p) { return !p.folded && !p.allIn && !p.sittingOut && (!p.acted || p.bet < this.currentBet); };

  P.nextIndex = function (from) {
    for (var i = 1; i <= this.players.length; i++) {
      var idx = (from + i) % this.players.length;
      if (this.needToAct(this.players[idx])) return idx;
    }
    return -1;
  };

  P.legal = function () {
    var p = this.players[this.toAct];
    if (!p) return null;
    var toCall = this.currentBet - p.bet;
    var minRaiseTo = this.currentBet + this.lastRaise;
    var maxRaiseTo = p.bet + p.stack; // all-in
    return {
      toCall: Math.min(toCall, p.stack),
      canCheck: toCall === 0,
      canCall: toCall > 0,
      canRaise: p.stack > toCall,
      minRaiseTo: Math.min(minRaiseTo, maxRaiseTo),
      maxRaiseTo: maxRaiseTo,
      stack: p.stack, pot: this.pot, you: p.isYou
    };
  };

  // apply an action for current actor; returns event string
  P.apply = function (type, amount) {
    var p = this.players[this.toAct];
    if (!p) return 'none';
    var toCall = this.currentBet - p.bet;
    if (type === 'fold') { p.folded = true; p.lastAct = 'Fold'; }
    else if (type === 'check') { p.lastAct = 'Check'; }
    else if (type === 'call') { this.commit(p, toCall); p.lastAct = p.allIn ? 'All-in' : 'Call ' + Bank.fmtShort(Math.min(toCall, p.totalIn)); if (p.allIn) p.lastAct = 'All-in'; else p.lastAct = 'Call'; }
    else if (type === 'raise' || type === 'allin') {
      var target = type === 'allin' ? p.bet + p.stack : amount;
      target = Math.max(target, this.currentBet); // safety
      var need = target - p.bet;
      this.commit(p, need);
      if (p.bet > this.currentBet) { this.lastRaise = Math.max(this.lastRaise, p.bet - this.currentBet); this.currentBet = p.bet; this.raisesThisStreet++; }
      p.lastAct = p.allIn ? 'All-in ' + Bank.fmtShort(p.bet) : (this.players.filter(function(x){return x.lastAct&&x.lastAct.indexOf('Raise')>=0;}).length||toCall>0 ? 'Raise ' : 'Bet ') + Bank.fmtShort(p.bet);
    }
    p.acted = true;
    return this.advance();
  };

  // figure out what happens next; returns: 'await' | 'deal' | 'showdown' | 'win'
  P.advance = function () {
    // everyone folded but one
    if (this.alive().length === 1) { return this.awardSingle(); }
    var next = this.nextIndex(this.toAct);
    if (next !== -1) { this.toAct = next; return 'await'; }
    // betting round complete
    if (this.canAct().length <= 1) {
      // run out remaining board to showdown
      return this.runoutAndShowdown();
    }
    return this.dealNextStreet();
  };

  P.dealNextStreet = function () {
    var self = this;
    this.players.forEach(function (p) { p.bet = 0; p.acted = false; p.lastAct = p.folded ? 'Fold' : ''; });
    this.currentBet = 0; this.lastRaise = BB; this.raisesThisStreet = 0;
    if (this.street === 'preflop') { this.deck.pop(); for (var i = 0; i < 3; i++) this.community.push(this.deck.pop()); this.street = 'flop'; }
    else if (this.street === 'flop') { this.deck.pop(); this.community.push(this.deck.pop()); this.street = 'turn'; }
    else if (this.street === 'turn') { this.deck.pop(); this.community.push(this.deck.pop()); this.street = 'river'; }
    else if (this.street === 'river') { return this.showdown(); }
    // first to act after button
    var order = this.seatedOrderFrom(this.button + 1);
    var first = order.find(function (p) { return !p.folded && !p.allIn; });
    this.toAct = first ? this.players.indexOf(first) : -1;
    if (this.toAct === -1) return this.runoutAndShowdown();
    return 'deal';
  };

  P.runoutAndShowdown = function () {
    // deal remaining community then showdown
    while (this.community.length < 5) { this.deck.pop(); this.community.push(this.deck.pop()); }
    return this.showdown();
  };

  P.awardSingle = function () {
    var winner = this.alive()[0];
    winner.stack += this.pot; winner.won = this.pot;
    this.lastResult = { winners: [winner.id], pot: this.pot, showdown: false, hands: {} };
    this.street = 'handover';
    if (winner.isYou) this.syncBank(); else this.syncBank();
    this.message = winner.name + ' wins ' + Bank.fmt(this.pot);
    return 'win';
  };

  P.showdown = function () {
    var self = this;
    this.street = 'showdown';
    var contenders = this.alive();
    var hands = {};
    contenders.forEach(function (p) {
      var sc = EV.evaluate(p.hole.concat(self.community));
      hands[p.id] = { score: sc, name: EV.rankName(sc) };
    });
    // best
    var best = null;
    contenders.forEach(function (p) { if (!best || EV.cmp(hands[p.id].score, hands[best].score) > 0) best = p.id; });
    var winners = contenders.filter(function (p) { return EV.cmp(hands[p.id].score, hands[best].score) === 0; }).map(function (p) { return p.id; });
    var share = Math.floor(this.pot / winners.length);
    winners.forEach(function (wid) { var pl = self.players[wid]; pl.stack += share; pl.won = share; });
    this.lastResult = { winners: winners, pot: this.pot, showdown: true, hands: hands };
    this.street = 'handover';
    this.syncBank();
    var names = winners.map(function (id) { return self.players[id].name; }).join(' & ');
    this.message = names + ' win' + (winners.length>1?'':'s') + ' ' + Bank.fmt(this.pot) + ' · ' + hands[winners[0]].name;
    return 'showdown';
  };

  /* ---- AI ---- */
  P.botDecision = function () {
    var p = this.players[this.toAct];
    var toCall = this.currentBet - p.bet;
    var s = EV.strength(p, this.community) + (Math.random() * 0.16 - 0.08);
    var potOdds = toCall / (this.pot + toCall || 1);
    var L = this.legal();
    function roundTo(x) { return Math.max(BB, Math.round(x / BB) * BB); }

    if (toCall === 0) {
      if (s > 0.6 && this.raisesThisStreet < 3) {
        var bet = roundTo(this.pot * (0.45 + Math.random() * 0.4));
        var target = Math.min(p.bet + bet, L.maxRaiseTo);
        if (target >= L.minRaiseTo) return { type: 'raise', amount: target };
      }
      if (s > 0.5 && Math.random() < 0.35) {
        var bet2 = roundTo(this.pot * 0.4);
        var t2 = Math.min(p.bet + bet2, L.maxRaiseTo);
        if (t2 >= L.minRaiseTo) return { type: 'raise', amount: t2 };
      }
      return { type: 'check' };
    }
    // facing a bet
    if (s > 0.8 && this.raisesThisStreet < 4 && p.stack > toCall) {
      var rr = roundTo(this.currentBet + this.pot * (0.6 + Math.random() * 0.5));
      var rt = Math.min(rr, L.maxRaiseTo);
      if (rt >= L.minRaiseTo) return { type: 'raise', amount: rt };
    }
    var callOk = (s > potOdds + 0.12) || (s > 0.42 && toCall <= p.stack * 0.12);
    if (callOk) return { type: 'call' };
    if (s > 0.3 && toCall <= p.stack * 0.06 && Math.random() < 0.5) return { type: 'call' };
    return { type: 'fold' };
  };

  P.snapshot = function () {
    return { players: this.players, community: this.community, pot: this.pot, currentBet: this.currentBet,
      toAct: this.toAct, street: this.street, button: this.button, lastResult: this.lastResult, message: this.message, handNo: this.handNo };
  };

  PokerGame.SB = SB; PokerGame.BB = BB;
  w.PokerGame = PokerGame;
})(window);
