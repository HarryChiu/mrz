import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDigit, parseTD3, findMRZ } from '../src/lib/mrz.js';

const L1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
const L2 = 'L898902C36UTO7408122F1204159ZE184226B<<<<<10';

test('check digit matches ICAO example', () => {
  assert.equal(checkDigit('L898902C3'), '6');
  assert.equal(checkDigit('740812'), '2');
  assert.equal(checkDigit('120415'), '9');
});

test('parses the ICAO specimen', () => {
  const r = parseTD3(L1, L2);
  assert.equal(r.lastName, 'ERIKSSON');
  assert.equal(r.firstName, 'ANNA MARIA');
  assert.equal(r.passportNumber, 'L898902C3');
  assert.equal(r.nationality, 'UTO');
  assert.equal(r.issuingCountry, 'UTO');
  assert.equal(r.dob, '1974-08-12');
  assert.equal(r.sex, 'F');
  assert.equal(r.expiry, '2012-04-15');
  assert.deepEqual(r.checks, { passportNumber: true, dob: true, expiry: true, personalNumber: true, composite: true });
  assert.equal(r.valid, true);
});

test('repairs common OCR confusions', () => {
  const noisy1 = 'P<UT0ERIKSS0N<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
  const noisy2 = 'L8989O2C36UTO74O8122F12O4159ZE184226B<<<<<1O';
  const r = parseTD3(noisy1, noisy2);
  assert.equal(r.lastName, 'ERIKSSON');
  assert.equal(r.passportNumber, 'L898902C3');
  assert.equal(r.dob, '1974-08-12');
  assert.equal(r.valid, true);
  assert.equal(r.checks.composite, true);
});

test('findMRZ locates lines inside noisy OCR output', () => {
  const text = `PASSPORT  UTOPIA\nSome header text here\n${L1.replace(/<</g, '« ')}\n${L2}\n`;
  const r = findMRZ(text);
  assert.ok(r);
  assert.equal(r.passportNumber, 'L898902C3');
  assert.equal(r.valid, true);
});

test('handles missing trailing fillers and spaces', () => {
  const r = findMRZ(`${'P<UTOERIKSSON<<ANNA<MARIA'}\n${'L898902C36UTO7408122F1204159ZE184226B <<<<<10'}`);
  assert.ok(r);
  assert.equal(r.firstName, 'ANNA MARIA');
  assert.equal(r.valid, true);
});

test('returns null when nothing looks like an MRZ', () => {
  assert.equal(findMRZ('hello world\nnothing here'), null);
});

test('cleans filler look-alikes out of the name zone', () => {
  const r = parseTD3('P<UTOERIKSSON<<ANNA<MARIA<KLLLLLLLLLLLLLLLLLL', L2);
  assert.equal(r.firstName, 'ANNA MARIA');
  const r2 = parseTD3('P<UTOERIKSSON<<ANNA<MARIA<KL<LLLLLLLLLLLLLLLLKL', L2);
  assert.equal(r2.firstName, 'ANNA MARIA');
  // Real names ending in look-alike letters are preserved.
  const r3 = parseTD3('P<GBRSMITH<<PAUL<ERIK<<<<<<<<<<<<<<<<<<<<<<<', L2);
  assert.equal(r3.firstName, 'PAUL ERIK');
});

test('recovers from one stray or dropped character in line 2', () => {
  const stray = findMRZ(`${L1}\n1${L2}`);
  assert.equal(stray.passportNumber, 'L898902C3');
  assert.equal(stray.valid, true);
  const extra0 = findMRZ(`${L1}\nL898902C36UTO07408122F1204159ZE184226B<<<<<10`);
  assert.equal(extra0.dob, '1974-08-12');
  assert.equal(extra0.nationality, 'UTO');
  assert.equal(extra0.checks.composite, true);
  const dropped = findMRZ(`${L1}\nL898902C36UTO7408122F1204159ZE184226B<<<<10`);
  assert.equal(dropped.checks.composite, true);
});

test('recovers from two stray characters in line 2', () => {
  const r = findMRZ(`${L1}\n1L898902C36UTO07408122F1204159ZE184226B<<<<<10`);
  assert.equal(r.nationality, 'UTO');
  assert.equal(r.passportNumber, 'L898902C3');
  assert.equal(r.checks.composite, true);
});

test('treats chevron look-alikes in names and the optional zone as fillers', () => {
  const r = findMRZ('P<GBRSMITH<K<JOHN<PAUL<<<<<<<<<<<<<<<<<<<<<<\n1234567897GBR8501019M2801016<<<<<<<L<L<K<K<0');
  assert.equal(r.lastName, 'SMITH');
  assert.equal(r.firstName, 'JOHN PAUL');
  assert.equal(r.personalNumber, '');
  assert.equal(r.checks.composite, true);
  assert.equal(r.valid, true);
});

test('rebuilds the surname separator when OCR reads chevrons as letters (US specimen)', () => {
  const r = findMRZ('PPCUSAJANECCMARY<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n9102392482USA6401171F1812051900781200<129676');
  assert.equal(r.documentType, 'P');
  assert.equal(r.issuingCountry, 'USA');
  assert.equal(r.lastName, 'JANE');
  assert.equal(r.firstName, 'MARY');
  assert.equal(r.passportNumber, '910239248');
  assert.equal(r.dob, '1964-01-17');
  assert.equal(r.expiry, '2018-12-05');
  assert.equal(r.sex, 'F');
  assert.equal(r.valid, true);
  assert.equal(r.checks.composite, true);
  const r2 = findMRZ('P<GBRWILLIAMS<CKATE<<<<<<<<<<<<<<<<<<<<<<<<<\n9102392482USA6401171F1812051900781200<129676');
  assert.equal(r2.lastName, 'WILLIAMS');
  assert.equal(r2.firstName, 'KATE');
});

test('re-aligns the issuing country when the chevron after P is dropped', () => {
  const r = findMRZ('PUSAJANE<<MARY<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n9102392482USA6401171F1812051900781200<129676');
  assert.equal(r.issuingCountry, 'USA');
  assert.equal(r.lastName, 'JANE');
});

test('decodes the real OCR output of the US specimen screenshot', () => {
  const r = findMRZ('5      SEEPAGE51         ETE\nBPCUSAJANECCMARY<CCCCLC\nE9102392482USA6401171F1812051900781200<129676\n');
  assert.equal(r.issuingCountry, 'USA');
  assert.equal(r.lastName, 'JANE');
  assert.equal(r.firstName, 'MARY');
  assert.equal(r.valid, true);
});

test('drops filler junk after the names (second US specimen read)', () => {
  const r = findMRZ('P<USAJANE<CMARY<<<CCCCCCCCCLLCCQQLR<<<<<<<<<\n9102392482USA6401171F1812051900781200<129676');
  assert.equal(r.lastName, 'JANE');
  assert.equal(r.firstName, 'MARY');
  const r2 = findMRZ('P<USAJANE<<MARY<CCCCCCCCCCLLCCQQLR<<<<<<<<<<\n9102392482USA6401171F1812051900781200<129676');
  assert.equal(r2.firstName, 'MARY');
  // Real multi-word names with look-alike letters survive.
  const r3 = findMRZ('P<GBRKELLY<<VICTORIA<LUCK<<<<<<<<<<<<<<<<<<<\n9102392482USA6401171F1812051900781200<129676');
  assert.equal(r3.lastName, 'KELLY');
  assert.equal(r3.firstName, 'VICTORIA LUCK');
});

test('votes line 1 across several OCR passes', () => {
  const L2US = '9102392482USA6401171F1812051900781200<129676';
  const reads = [
    'PCUSAJANECSMARY<<<CCLCLLLLLLLLLLLLCC', 'BRUSAJANE<<MARY<<<LLLELLLLLLLLLLCCLCCCC<',
    'BESCUSAJANECCMARY<CC', 'BRRUSAJANE<<MARY<<<<<<SEL', 'PCUSAJANECKMARYCCCCECEEC',
    'IEBRUSAIANE<<HARY<<<<<CLLLELL', 'EEBRUSAJANE<<HARY<<<CCCELILLLLLLOL',
  ];
  const r = findMRZ(reads.map((l1) => `${l1}\n${L2US}`));
  assert.equal(r.issuingCountry, 'USA');
  assert.equal(r.lastName, 'JANE');
  assert.equal(r.firstName, 'MARY');
  assert.equal(r.valid, true);
  // Heavily shifted prefix is realigned on its own too.
  const one = findMRZ(`EIEBRUSAJANE<<MARY<<<<<<LEC\n${L2US}`);
  assert.equal(one.issuingCountry, 'USA');
  assert.equal(one.lastName, 'JANE');
});

test('repairs misread country codes using the other line as a hint', () => {
  const r = findMRZ('P<UTODOE<<JOHN<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\nDE000011140TO9101106M2606200<<<<<<<<<<<<<<06');
  assert.equal(r.nationality, 'UTO');
  assert.equal(r.passportNumber, 'DE0000111');
  assert.equal(r.valid, true);
  const r2 = findMRZ('P<USAJANE<<MARY<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n9102392482U5A6401171F1812051900781200<129676');
  assert.equal(r2.nationality, 'USA');
  const r3 = findMRZ('P<U5AJANE<<MARY<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n9102392482USA6401171F1812051900781200<129676');
  assert.equal(r3.issuingCountry, 'USA');
});

test('drops a stray single letter before the fillers', () => {
  const r = findMRZ('P<USAJANE<<MARY<Z<<<<<<<<<<<<<<<<<<<<<<<<<<<\n9102392482USA6401171F1812051900781200<129676');
  assert.equal(r.firstName, 'MARY');
});

test('uses OCR line confidence to break ties between name reads', () => {
  const L2US = '9102392482USA6401171F1812051900781200<129676';
  const texts = [`BUBAJANE<<RARY<<<<<<<<<<<\n${L2US}`, `RUSAJANE<<RARY<<<<<<<<<<<\n${L2US}`, `<USAJANE<<MARY<<<<<<<<<<<\n${L2US}`];
  const conf = { 'BUBAJANE<<RARY<<<<<<<<<<<': 40, 'RUSAJANE<<RARY<<<<<<<<<<<': 0, '<USAJANE<<MARY<<<<<<<<<<<': 87 };
  const r = findMRZ(texts, (l) => conf[l] || 0);
  assert.equal(r.firstName, 'MARY');
});

test('prefers an unedited read over an edited string that passes the check digits by chance', () => {
  const L1 = 'P<USAJANE<<MARY<<<<<<<<<<<<<<<<<<<<<<<<<<<<<';
  const good = '9102392482USA6401171F1812051900781200<129676';
  // 45-char garbage read whose single-deletion variants include a check-passing lookalike.
  const bad = 'JOZ39Z4B<2USA6401171F1812051900781200<1296766';
  const r = findMRZ([`${L1}\n${bad}`, `${L1}\n${good}`, `${L1}\n${good}`]);
  assert.equal(r.passportNumber, '910239248');
});
