// ICAO 9303 TD3 (passport) MRZ parsing, validation and OCR error correction.
// Pure functions, no DOM, no side effects.
import { resolveCountry } from './countries.js';

const knownCountry = (c) => c === 'UTO' || resolveCountry(c).a2 !== '';

const WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';

// Characters OCR commonly confuses, by target class.
const TO_DIGIT = { O: '0', Q: '0', D: '0', U: '0', I: '1', L: '1', J: '1', Z: '2', E: '3', A: '4', S: '5', G: '6', T: '7', B: '8', '<': '0' };
const TO_ALPHA = { 0: 'O', 1: 'I', 2: 'Z', 3: 'E', 4: 'A', 5: 'S', 6: 'G', 7: 'T', 8: 'B', 9: 'G' };
// Ambiguous pairs tried in both directions for alphanumeric fields.
const AMBIGUOUS = { O: '0', 0: 'O', I: '1', 1: 'I', S: '5', 5: 'S', B: '8', 8: 'B', Z: '2', 2: 'Z', G: '6', 6: 'G', D: '0', Q: '0' };

export function charValue(ch) {
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48;
  if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 55;
  return 0; // '<'
}

export function checkDigit(str) {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < str.length; i++) sum += charValue(str[i]) * weights[i % 3];
  return String(sum % 10);
}

function verify(field, digit) {
  return checkDigit(field) === digit;
}

/** Normalise a raw OCR line into the MRZ alphabet. */
export function normalizeLine(raw) {
  let s = raw.toUpperCase().replace(/\s+/g, '');
  s = s.replace(/[«»‹›()\[\]{}|/\\_\-~^*'`",.:;=+]/g, '<');
  s = s.replace(/[^A-Z0-9<]/g, '');
  return s;
}

function fixLength(s, len = 44) {
  if (s.length < len) return s + '<'.repeat(len - s.length);
  if (s.length > len) return s.slice(0, len);
  return s;
}

function mapRange(s, from, to, map) {
  const chars = s.split('');
  for (let i = from; i <= to && i < chars.length; i++) {
    if (map[chars[i]] !== undefined) chars[i] = map[chars[i]];
  }
  return chars.join('');
}

/** Line 1: P<ISS<<SURNAME<<GIVEN<NAMES<<<<... (letters and '<' only). */
/** @param natHint nationality read from line 2; the issuing country usually matches it. */
export function correctLine1(raw, natHint = '') {
  let s = fixLength(normalizeLine(raw));
  s = mapRange(s, 2, 43, TO_ALPHA);
  s = 'P' + s.slice(1); // document type is always P for passports
  // Position 1 is '<' on ordinary passports; OCR often renders that chevron as P, C, K or L.
  if (/[PCKLEIXTV]/.test(s[1])) s = 'P<' + s.slice(2);
  // Re-align the issuing country when the leading "P<" was read as extra or missing characters:
  // look for the nationality from line 2 (or any known country) within the first few characters.
  const plausible = (c) => knownCountry(c) || (natHint && c === natHint);
  if (!plausible(s.slice(2, 5))) {
    let idx = -1;
    if (natHint && knownCountry(natHint)) idx = s.indexOf(natHint, 1);
    if (idx < 0 || idx > 9) {
      for (let i = 1; i <= 9 && idx < 0; i++) if (knownCountry(s.slice(i, i + 3))) idx = i;
    }
    if (idx >= 1 && idx <= 9) s = fixLength('P<' + s.slice(idx));
  }
  s = s.slice(0, 2) + repairCountry(s.slice(2, 5), natHint) + s.slice(5);
  return repairSeparator(cleanFillers(s));
}

// Characters OCR swaps inside three-letter country codes.
const COUNTRY_SUBS = { 0: 'OUDQ', O: 'UDQ0', U: 'OV', D: 'O0', Q: 'O0', 1: 'IL', I: 'L1T', L: 'IE', 5: 'S', S: '5', 8: 'B', B: '8R', 2: 'Z', Z: '2', 6: 'G', G: '6C', C: 'GO', 4: 'A', A: '4', 7: 'T', T: '7I', 3: 'E', E: '3F', F: 'EP', R: 'BP', M: 'NH', N: 'MH', H: 'MN', K: 'R', V: 'UY', Y: 'V', P: 'FR', W: 'VM', X: 'K', J: 'I' };

/** Repair a misread country code: keep it if known (or equal to the hint), otherwise try
 *  single-character substitutions and prefer the hint, then any known country. */
export function repairCountry(code, hint = '') {
  const c = code.replace(/</g, '');
  if (c.length !== 3) return code;
  if (knownCountry(c) || (hint && c === hint)) return code;
  let fallback = null;
  for (let i = 0; i < 3; i++) {
    for (const sub of (COUNTRY_SUBS[c[i]] || '')) {
      const cand = c.slice(0, i) + sub + c.slice(i + 1);
      if (hint && cand === hint) return cand;
      if (!fallback && knownCountry(cand)) fallback = cand;
    }
  }
  return fallback || code;
}

/** How much a corrected line 1 looks like a genuine passport name line. Higher is better. */
export function line1Quality(l1, natHint = '') {
  const names = l1.slice(5);
  const country = l1.slice(2, 5);
  let q = 0;
  if (natHint && country === natHint) q += 2; else if (knownCountry(country)) q += 1;
  const sep = names.match(/^([A-Z]+(?:<[A-Z]+)*)<<([A-Z]+(?:<[A-Z]+)*)<*$/);
  if (sep) {
    q += 2;
    if (sep[2].length >= 2) q += 1;
    if (sep[1].length >= 2) q += 1;
    const tokens = [...sep[1].split('<'), ...sep[2].split('<')];
    for (const t of tokens) { if (isJunk(t)) q -= 1.5; if (t.length === 1) q -= 0.5; }
  } else {
    q -= 2;
  }
  q -= 0.3 * (names.match(/<[KLC](?=[A-Z])|[KLC](?=<)/g) || []).length;
  if (/[0-9]/.test(names)) q -= 1;
  return q;
}

// Pairs that OCR produces for the "<<" surname separator, most distinctive first.
const SEPARATOR_PAIRS = ['<C', 'C<', '<K', 'K<', '<L', 'L<', '<E', 'E<', '<X', 'X<',
  'CC', 'KK', 'CK', 'KC', 'XX', 'CL', 'KL', 'LC', 'LK', 'CE', 'EC', 'KE', 'EK',
  'LL', 'EE', 'II', 'TT', 'TC', 'CT', 'KT', 'TK'];

/** A valid line 1 always holds "<<" between surname and given names. When it is missing the OCR
 *  misread the chevrons, so rebuild it from the most likely look-alike pair. */
function repairSeparator(s) {
  const names = s.slice(5);
  // Trailing fillers also contain "<<"; the separator we need is the one followed by given names.
  if (/<<[A-Z]/.test(names)) return s;
  for (const pair of SEPARATOR_PAIRS) {
    const i = names.indexOf(pair, 1);
    if (i > 0) return s.slice(0, 5) + names.slice(0, i) + '<<' + names.slice(i + 2);
  }
  return s;
}

/** True when a run of letters looks like misread chevrons rather than a name:
 *  a triple repeat (CCC, LLL), mostly chevron look-alikes, or a long vowel-less string. */
function isJunk(word) {
  if (!word) return false;
  if (/([A-Z])\1\1/.test(word)) return true;
  const lookalikes = (word.match(/[CKLQX]/g) || []).length;
  if (word.length >= 5 && lookalikes / word.length >= 0.7) return true;
  return word.length >= 6 && !/[AEIOUY]/.test(word);
}

// Letters that OCR produces when it misreads the '<' filler glyph.
const FILLER_LOOKALIKES = /[KLCEIXTV]/;

/** Remove filler misreads from the name zone: trailing runs of one look-alike letter, and
 *  single look-alike letters sandwiched inside runs of '<'. */
function cleanFillers(s) {
  let names = s.slice(5);
  // Trailing region made only of '<' and look-alike letters. The leading contiguous letters of
  // that region belong to the real name (e.g. "VICKI<<<"); everything after the first '<' is
  // filler, as is a leading block containing a triple run such as "LLLL".
  const tail = names.match(/[KLCEIXTV<]+$/);
  if (tail) {
    const start = names.length - tail[0].length;
    const firstLt = tail[0].indexOf('<');
    if (firstLt >= 0) {
      const lead = tail[0].slice(0, firstLt);
      const wipeFrom = /([KLCEIXTV])\1\1/.test(lead) ? start : start + firstLt;
      names = names.slice(0, wipeFrom) + '<'.repeat(names.length - wipeFrom);
    }
  }
  // Structural end of names: a run of 3+ chevrons can only be filler, so anything after it
  // is filler too, provided what follows looks like junk rather than a real name
  // (OCR occasionally reads "<<" as "<<<").
  const run = names.match(/<{3,}/);
  if (run && run.index + run[0].length < names.length) {
    const rest = names.slice(run.index + run[0].length);
    if (isJunk(rest.replace(/</g, ''))) names = names.slice(0, run.index) + '<'.repeat(names.length - run.index);
  }
  // Junk tokens: a name component that looks like misread chevrons, and everything after it.
  const tokens = names.split('<');
  let pos = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] && isJunk(tokens[i]) && (i > 0 || tokens[i].length >= 6)) {
      names = names.slice(0, pos) + '<'.repeat(names.length - pos);
      break;
    }
    pos += tokens[i].length + 1;
  }
  // A one-letter token right before the fillers is a misread chevron (MRZ names carry no initials).
  names = names.replace(/<([A-Z])(<{3,})$/, (m, ch, rest) => '<<' + rest);
  // Sandwiched: a single look-alike letter between '<' on both sides is a misread chevron
  // (a one-letter name component is far rarer than this OCR error).
  let changed = true;
  while (changed) {
    changed = false;
    names = names.replace(/(<+)([KLCEIXTV])(<+)/g, (m, a, ch, b) => { changed = true; return a + '<' + b; });
  }
  return s.slice(0, 5) + names;
}

/**
 * Line 2 positions: 0-8 number, 9 check, 10-12 nationality, 13-18 DOB, 19 check,
 * 20 sex, 21-26 expiry, 27 check, 28-41 personal number, 42 check, 43 composite.
 */
const memo = new Map();
function memoized(key, fn) {
  if (memo.has(key)) return memo.get(key);
  if (memo.size > 20000) memo.clear();
  const v = fn();
  memo.set(key, v);
  return v;
}

/** @param natHint issuing country read from line 1, which usually equals the nationality. */
export function correctLine2(raw, natHint = '') {
  return memoized(`2|${natHint}|${raw}`, () => correctLine2Impl(raw, natHint));
}

/** Cheap class-based correction only (no check-digit search); used to pre-filter candidates. */
export function classCorrectLine2(raw) {
  let s = fixLength(normalizeLine(raw));
  s = mapRange(s, 9, 9, TO_DIGIT);
  s = mapRange(s, 13, 19, TO_DIGIT);
  s = mapRange(s, 21, 27, TO_DIGIT);
  s = mapRange(s, 43, 43, TO_DIGIT);
  const sexMap = { H: 'M', N: 'M', W: 'M', P: 'F', E: 'F', K: '<', X: '<', 0: '<' };
  if (sexMap[s[20]]) s = s.slice(0, 20) + sexMap[s[20]] + s.slice(21);
  return s;
}

function correctLine2Impl(raw, natHint) {
  let s = fixLength(normalizeLine(raw));
  s = mapRange(s, 9, 9, TO_DIGIT);
  s = mapRange(s, 13, 19, TO_DIGIT);
  s = mapRange(s, 21, 27, TO_DIGIT);
  s = mapRange(s, 43, 43, TO_DIGIT);
  const sexMap = { H: 'M', N: 'M', W: 'M', P: 'F', E: 'F', K: '<', X: '<', 0: '<' };
  if (sexMap[s[20]]) s = s.slice(0, 20) + sexMap[s[20]] + s.slice(21);
  if (s[42] !== '<') s = mapRange(s, 42, 42, TO_DIGIT);
  s = s.slice(0, 10) + repairCountry(s.slice(10, 13), natHint) + s.slice(13);
  // Passport number: try alternatives for ambiguous characters until its check digit passes.
  s = s.slice(0, 9).padEnd(9, '<') + s.slice(9);
  s = repairAlnumField(s, 0, 8, s[9]);
  if (s.slice(28, 42) !== '<'.repeat(14) && s[42] !== '<') s = repairAlnumField(s, 28, 41, s[42]);
  // Optional-data zone that is empty on most passports: if it only holds chevron look-alikes
  // and is mostly '<' already, treat it as all fillers (and its check digit as '<').
  const zone = s.slice(28, 43);
  if (/[KLCEIXTV]/.test(zone) && /^[KLCEIXTV<]+$/.test(zone) && (zone.match(/</g) || []).length >= 8) {
    s = s.slice(0, 28) + '<'.repeat(15) + s.slice(43);
  }
  return s;
}

function repairAlnumField(s, from, to, digit) {
  const field = s.slice(from, to + 1);
  if (verify(field, digit)) return s;
  const positions = [];
  for (let i = 0; i < field.length; i++) if (AMBIGUOUS[field[i]]) positions.push(i);
  if (positions.length === 0 || positions.length > 7) return s;
  const combos = 1 << positions.length;
  for (let mask = 1; mask < combos; mask++) {
    const chars = field.split('');
    for (let b = 0; b < positions.length; b++) {
      if (mask & (1 << b)) chars[positions[b]] = AMBIGUOUS[chars[positions[b]]];
    }
    const cand = chars.join('');
    if (verify(cand, digit)) return s.slice(0, from) + cand + s.slice(to + 1);
  }
  return s;
}

function parseDate(yymmdd, kind) {
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  if (Number.isNaN(yy) || !/^\d{6}$/.test(yymmdd)) return null;
  const nowYY = new Date().getFullYear() % 100;
  let century;
  if (kind === 'expiry') century = yy <= nowYY + 20 ? 2000 : 1900;
  else century = yy > nowYY ? 1900 : 2000;
  const y = century + yy;
  const m = parseInt(mm, 10);
  const d = parseInt(dd, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${mm}-${dd}`;
}

function cleanName(s) {
  return s.replace(/</g, ' ').replace(/\s+/g, ' ').trim();
}

/** Parse two corrected 44-char lines. Returns a result object with per-field check results. */
export function parseTD3(line1, line2) {
  return memoized(`p|${line1}|${line2}`, () => parseTD3Impl(line1, line2));
}

function parseTD3Impl(line1, line2) {
  let l2 = correctLine2(line2);
  const l1 = correctLine1(line1, l2.slice(10, 13));
  const issuer = l1.slice(2, 5);
  if (!knownCountry(l2.slice(10, 13).replace(/</g, '')) && knownCountry(issuer)) l2 = correctLine2(line2, issuer);
  const names = l1.slice(5);
  const sep = names.indexOf('<<');
  const surname = cleanName(sep >= 0 ? names.slice(0, sep) : names);
  const given = cleanName(sep >= 0 ? names.slice(sep + 2) : '');

  const passportNumber = l2.slice(0, 9).replace(/</g, '');
  const dobRaw = l2.slice(13, 19);
  const expRaw = l2.slice(21, 27);
  const personal = l2.slice(28, 42);
  const sexCh = l2[20];

  const checks = {
    passportNumber: verify(l2.slice(0, 9), l2[9]),
    dob: verify(dobRaw, l2[19]),
    expiry: verify(expRaw, l2[27]),
    personalNumber: personal.replace(/</g, '') === '' ? (l2[42] === '<' || l2[42] === '0') : verify(personal, l2[42]),
    composite: verify(l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 43), l2[43]),
  };
  const dob = parseDate(dobRaw, 'dob');
  const expiry = parseDate(expRaw, 'expiry');
  const nat = l2.slice(10, 13).replace(/</g, '');
  const score = [checks.passportNumber, checks.dob, checks.expiry, checks.composite, checks.personalNumber].filter(Boolean).length
    + (dob ? 1 : 0) + (expiry ? 1 : 0) + (surname ? 1 : 0) + (given ? 0.5 : 0)
    + (resolveCountry(nat).a2 !== '' || nat === 'UTO' ? 0.5 : 0)
    - 0.1 * classViolations(line2)
    - 0.05 * (l1.slice(5).match(/<[KLC](?=[A-Z])|[KLC](?=<)/g) || []).length;

  return {
    documentType: l1.slice(0, 2).replace(/</g, ''),
    issuingCountry: l1.slice(2, 5).replace(/</g, ''),
    lastName: surname,
    firstName: given,
    passportNumber,
    nationality: l2.slice(10, 13).replace(/</g, ''),
    dob,
    sex: sexCh === 'M' ? 'M' : sexCh === 'F' ? 'F' : 'X',
    expiry,
    personalNumber: personal.replace(/</g, ''),
    checks,
    valid: checks.passportNumber && checks.dob && checks.expiry && !!dob && !!expiry,
    score,
    raw: [l1, l2],
  };
}

/** A 44-char line as read, plus every single-character deletion (too long) or '<' insertion
 *  (too short) so one stray or dropped OCR character does not shift every field. */
function lengthVariants(line) {
  const out = new Map([[line, 0]]); // candidate -> number of edits
  const add = (v, edits) => { if (!out.has(v)) out.set(v, edits); };
  const del = (str) => { const r = []; for (let i = 0; i < str.length; i++) r.push(str.slice(0, i) + str.slice(i + 1)); return r; };
  const ins = (str) => { const r = []; for (let i = 0; i <= str.length; i++) r.push(str.slice(0, i) + '<' + str.slice(i)); return r; };
  if (line.length === 45) del(line).forEach((v) => add(v, 1));
  else if (line.length === 46) del(line).forEach((v) => del(v).forEach((w) => add(w, 2)));
  else if (line.length === 43) ins(line).forEach((v) => add(v, 1));
  else if (line.length === 42) ins(line).forEach((v) => ins(v).forEach((w) => add(w, 2)));
  return [...out.entries()].map(([text, edits]) => ({ text, edits }));
}

/** Number of characters the correction step changed (beyond simple class mapping is fine too):
 *  a read that needed many substitutions to pass its check digits is less trustworthy. */
function editDistanceToCorrected(raw, corrected) {
  const a = fixLength(normalizeLine(raw));
  let n = 0;
  for (let i = 0; i < 44; i++) if (a[i] !== corrected[i]) n++;
  return n;
}

/** Count characters of the wrong class at fixed positions of an uncorrected line 2.
 *  Used as a tie-breaker between candidates whose check digits all pass. */
function classViolations(raw) {
  const s = fixLength(normalizeLine(raw));
  let n = 0;
  const digit = (i) => { if (!/[0-9]/.test(s[i])) n++; };
  const alpha = (i) => { if (!/[A-Z<]/.test(s[i])) n++; };
  digit(9); for (let i = 13; i <= 19; i++) digit(i); for (let i = 21; i <= 27; i++) digit(i); digit(43);
  for (let i = 10; i <= 12; i++) alpha(i);
  if (!/[MF<]/.test(s[20])) n++;
  return n;
}

const LINE2_SHAPE = /^[A-Z0-9<]{9}[0-9][A-Z<]{3}[0-9]{7}[MF<][0-9]{7}/;

/**
 * Find the best TD3 line pair in OCR text. Accepts one text or an array of texts from several
 * OCR passes. Line 2 is chosen by its check digits; line 1 (which has none) is chosen by how
 * name-like it is plus agreement across passes. Returns null when nothing MRZ-like is present.
 */
export function findMRZ(textOrTexts, confidenceOf = () => 0) {
  const texts = Array.isArray(textOrTexts) ? textOrTexts : [textOrTexts];
  const pairs = []; // { l1raw, l2raw, conf }
  for (const text of texts) {
    const lines = text.split(/\r?\n/).map(normalizeLine).filter((l) => l.length >= 5);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length < 30) continue;
      const prev = (i > 0 ? lines[i - 1] : '') || 'P<';
      for (const { text: cand, edits } of lengthVariants(lines[i])) {
        if (!LINE2_SHAPE.test(classCorrectLine2(cand))) continue;
        // Keep only candidates whose date fields verify before running the expensive repair.
        const c = classCorrectLine2(cand);
        if (!verify(c.slice(13, 19), c[19]) && !verify(c.slice(21, 27), c[27])) continue;
        pairs.push({ l1raw: prev, l2raw: cand, edits, conf: confidenceOf(prev) });
      }
    }
    if (pairs.length === 0) {
      for (let i = 0; i + 1 < lines.length; i++) {
        if (lines[i + 1].length >= 30 && (/^P/.test(lines[i]) || lines[i].includes('<<'))) pairs.push({ l1raw: lines[i], l2raw: lines[i + 1], edits: 0, conf: confidenceOf(lines[i]) });
      }
    }
  }
  if (pairs.length === 0) return null;

  // Best line 2 by check digits, preferring reads that needed few edits and that several
  // passes agree on (a heavily edited string can satisfy the check digits by chance).
  const l2votes = new Map();
  for (const p of pairs) {
    p.l2 = correctLine2(p.l2raw);
    p.changed = editDistanceToCorrected(p.l2raw, p.l2);
    if (p.edits === 0) l2votes.set(p.l2, (l2votes.get(p.l2) || 0) + 1);
  }
  let bestPair = null; let bestScore = -Infinity;
  for (const p of pairs) {
    const r = parseTD3(p.l1raw, p.l2raw);
    const score = r.score - 0.4 * p.edits - 0.15 * p.changed + 0.5 * ((l2votes.get(p.l2) || 1) - 1);
    if (score > bestScore) { bestScore = score; bestPair = p; }
  }
  const natHint = bestPair.l2.slice(10, 13);

  // Best line 1 by quality + votes across all candidate name lines + OCR confidence.
  const votes = new Map();
  const seen = new Set();
  for (const p of pairs) {
    const key = `${p.l1raw}|${p.l2raw}`; // one vote per distinct read, not per length variant
    if (seen.has(key)) continue;
    seen.add(key);
    const l1 = correctLine1(p.l1raw, natHint);
    const names = l1.slice(5).replace(/<+$/, '');
    const v = votes.get(names) || { count: 0, conf: 0 };
    v.count += 1;
    v.conf = Math.max(v.conf, p.conf || 0);
    votes.set(names, v);
  }
  let bestL1 = null; let bestQ = -Infinity;
  for (const p of pairs) {
    const l1 = correctLine1(p.l1raw, natHint);
    const v = votes.get(l1.slice(5).replace(/<+$/, ''));
    const q = line1Quality(l1, natHint) + 0.7 * (v.count - 1) + v.conf / 40;
    if (q > bestQ) { bestQ = q; bestL1 = l1; }
  }
  const result = parseTD3(bestL1, bestPair.l2raw);
  return { ...result, agreement: l2votes.get(bestPair.l2) || 0 }; // passes that read this exact line 2
}

export { WHITELIST };
