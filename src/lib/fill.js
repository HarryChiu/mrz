// fillForm is injected into the active tab with chrome.scripting.executeScript({ func }).
// It is serialised with Function.toString(), so it must be fully self-contained:
// no imports, no references to anything outside its own body.

export function fillForm(payload) {
  const fields = payload.fields || {};
  const dateFormat = payload.dateFormat || 'auto';
  const filled = [];
  const seenRadioGroups = new Set();

  // ---------- helpers ----------
  const norm = (s) => String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/[_\-.:\[\]{}()/\\]+/g, ' ').replace(/([a-z])([0-9])/g, '$1 $2').replace(/\s+/g, ' ').trim();
  const textOf = (el) => (el ? norm(el.innerText || el.textContent) : '');

  function isVisible(el) {
    if (el.type === 'radio') return !el.disabled;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    return el.getClientRects().length > 0;
  }

  function collect(root, out) {
    const nodes = root.querySelectorAll('input, select, textarea');
    for (const el of nodes) out.push(el);
    const all = root.querySelectorAll('*');
    for (const el of all) if (el.shadowRoot) collect(el.shadowRoot, out);
  }

  function labelText(el) {
    const parts = [];
    const root = el.getRootNode();
    if (el.id) {
      try {
        const esc = (window.CSS && CSS.escape) ? CSS.escape(el.id) : el.id.replace(/"/g, '\\"');
        root.querySelectorAll(`label[for="${esc}"]`).forEach((l) => parts.push(textOf(l)));
      } catch (e) { /* ignore */ }
    }
    const wrap = el.closest('label');
    if (wrap) parts.push(textOf(wrap));
    const lb = el.getAttribute('aria-labelledby');
    if (lb) lb.split(/\s+/).forEach((id) => parts.push(textOf(root.getElementById ? root.getElementById(id) : document.getElementById(id))));
    return parts.join(' ');
  }

  function nearbyText(el) {
    // Only trust surrounding text when it clearly belongs to this one control: the nearest
    // ancestor with short text that contains no other form controls.
    let node = el;
    for (let depth = 0; depth < 4 && node && node.parentElement; depth++) {
      node = node.parentElement;
      const t = textOf(node);
      if (t.length > 200) break;
      if (node.querySelectorAll('input, select, textarea').length > 1) break;
      if (t && t.length <= 80) return t;
    }
    const prev = el.previousElementSibling;
    if (prev && !prev.matches('input, select, textarea') && !prev.querySelector('input, select, textarea')) {
      const t = textOf(prev);
      if (t.length <= 60) return t;
    }
    return '';
  }

  function strongDescriptor(el) {
    const attrs = ['autocomplete', 'name', 'id', 'placeholder', 'aria-label', 'title', 'data-field', 'data-name', 'data-testid', 'data-test', 'data-cy', 'data-qa', 'formcontrolname', 'ng-model', 'v-model', 'data-key'];
    const vals = attrs.map((a) => el.getAttribute(a)).filter(Boolean).map(norm);
    vals.push(norm(labelText(el)));
    return vals.join(' | ');
  }

  // Descriptor without placeholder/title (date placeholders like mm/dd/yyyy would confuse part detection).
  function partDescriptor(el) {
    return [el.getAttribute('name'), el.getAttribute('id'), el.getAttribute('aria-label'), el.getAttribute('data-field'), el.getAttribute('formcontrolname'), labelText(el)].filter(Boolean).map(norm).join(' | ');
  }

  // ---------- classification ----------
  const EXCL_NAME = /\b(user|login|email|e mail|company|employer|business|hotel|airline|street|city|state|file|card|holder|account|bank|contact|emergency|mother|father|spouse|parent|guardian|middle|display|nick|pet|project|product|org)\b/;
  const BIRTH_PLACE = /\b(place|country|city|town|state|province)\b.*\b(birth|born)\b|\b(birth|born)\b.*\b(place|country|city|town)\b|birthplace/;

  // Returns a field kind, 'skip' when the descriptor clearly names something we must not fill,
  // or null when it says nothing useful.
  function classify(d) {
    if (!d) return null;
    if (/\bexpir\w*|\b(exp date|exp dt|valid (until|till|thru|through|to)|date of exp|validity)\b/.test(d) || /\bexp\b/.test(d)) return 'expiry';
    if (/\b(issue|issued|issuing)\b/.test(d) && /\b(date|on|dt)\b/.test(d)) return 'skip'; // issue date: not in MRZ
    if (/\b(nationality|citizenship|citizen of|national of)\b/.test(d)) return 'nationality';
    if (/\b(issuing|issued by|issued in|country of issue|issue country|issuance|passport country|document country|country of passport|place of issue)\b/.test(d)) return 'issuingCountry';
    if (BIRTH_PLACE.test(d)) return 'skip';
    if (/\b(birth|dob|born|birthday|bday|birthdate|date of birth)\b/.test(d)) return 'dob';
    if (/\b(sex|gender)\b/.test(d)) return 'sex';
    if (/\b(passport|travel document|document|doc|id number|identity number|identification number|passportnumber|passport no|passport num)\b/.test(d)
      && !/\b(type|kind|class|category|upload|photo|image|scan|copy|country)\b/.test(d)) return 'passportNumber';
    if (EXCL_NAME.test(d)) return 'skip';
    if (/\b(first|given|forename|fname|firstname|given name|givenname)\b/.test(d)) return 'firstName';
    if (/\b(last|surname|family|lname|lastname|family name|familyname)\b/.test(d)) return 'lastName';
    if (/\b(full name|fullname|name|applicant name|passenger name|traveler name|traveller name|legal name)\b/.test(d) && !/\b(country|file|field|user)\b/.test(d)) return 'fullName';
    return null;
  }

  function datePart(el) {
    const d = partDescriptor(el);
    const day = /\b(day|dd|d)\b/.test(d);
    const month = /\b(month|mm|mon|m)\b/.test(d);
    const year = /\b(year|yyyy|yy|y)\b/.test(d);
    const n = [day, month, year].filter(Boolean).length;
    if (n !== 1) return null;
    return day ? 'day' : month ? 'month' : 'year';
  }

  // ---------- value setting ----------
  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value); else el.value = value;
  }

  function fire(el, type, init) {
    let ev;
    try {
      ev = type === 'input' ? new InputEvent('input', { bubbles: true, cancelable: false, inputType: 'insertText', ...init })
        : type === 'keyup' || type === 'keydown' ? new KeyboardEvent(type, { bubbles: true, cancelable: true })
          : new Event(type, { bubbles: true, cancelable: true });
    } catch (e) {
      ev = new Event(type, { bubbles: true });
    }
    el.dispatchEvent(ev);
  }

  function highlight(el) {
    const prev = el.style.boxShadow;
    el.style.boxShadow = '0 0 0 2px #22c55e';
    setTimeout(() => { el.style.boxShadow = prev; }, 2500);
  }

  function commitText(el, value) {
    try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    setNativeValue(el, value);
    fire(el, 'input', { data: value });
    fire(el, 'keyup');
    fire(el, 'change');
    fire(el, 'blur');
    fire(el, 'focusout');
    highlight(el);
  }

  function commitSelect(el, option) {
    try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    setNativeValue(el, option.value);
    option.selected = true;
    fire(el, 'input');
    fire(el, 'change');
    fire(el, 'blur');
    highlight(el);
  }

  function pickOption(el, candidates) {
    const opts = Array.from(el.options);
    const cands = candidates.filter(Boolean).map((c) => norm(c));
    // Exact match on value or text first, then prefix, then substring.
    for (const c of cands) {
      const hit = opts.find((o) => norm(o.value) === c || norm(o.text) === c);
      if (hit) return hit;
    }
    for (const c of cands) {
      if (c.length < 3) continue;
      const hit = opts.find((o) => norm(o.text).startsWith(c) || norm(o.text).includes(` ${c} `) || norm(o.text).includes(`(${c})`) || norm(o.text).includes(c));
      if (hit) return hit;
    }
    return null;
  }

  // ---------- date formatting ----------
  function splitISO(iso) {
    const [y, m, d] = iso.split('-');
    return { y, m, d };
  }

  function guessFormat(el) {
    if (dateFormat !== 'auto') return dateFormat;
    const hint = [el.getAttribute('placeholder'), el.getAttribute('title'), el.getAttribute('data-format'), el.getAttribute('data-date-format'), el.getAttribute('pattern'), labelText(el)].filter(Boolean).join(' ').toLowerCase();
    const m = hint.match(/(yyyy|yy|dd|mm)([^a-z0-9]?)(yyyy|yy|dd|mm)\2(yyyy|yy|dd|mm)/);
    if (m) return `${m[1]}${m[2]}${m[3]}${m[2]}${m[4]}`.toUpperCase();
    const lang = (navigator.language || 'en-US').toLowerCase();
    return lang === 'en-us' ? 'MM/DD/YYYY' : 'DD/MM/YYYY';
  }

  function formatDate(iso, fmt) {
    const { y, m, d } = splitISO(iso);
    return fmt.replace('YYYY', y).replace('YY', y.slice(2)).replace('MM', m).replace('DD', d);
  }

  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

  function fillDate(el, iso, part) {
    const { y, m, d } = splitISO(iso);
    const tag = el.tagName.toLowerCase();
    if (part) {
      const val = part === 'day' ? d : part === 'month' ? m : y;
      if (tag === 'select') {
        const idx = parseInt(val, 10);
        const cands = part === 'month' ? [val, String(idx), MONTHS[idx - 1], MONTHS[idx - 1].slice(0, 3)]
          : part === 'year' ? [val, y.slice(2)] : [val, String(idx)];
        const opt = pickOption(el, cands);
        if (opt) { commitSelect(el, opt); return true; }
        return false;
      }
      const maxLen = parseInt(el.getAttribute('maxlength') || '0', 10);
      const v = (part === 'year' && maxLen === 2) ? y.slice(2) : (part !== 'year' && maxLen === 1) ? String(parseInt(val, 10)) : val;
      commitText(el, v);
      return true;
    }
    if (tag === 'input' && el.type === 'date') { commitText(el, iso); return true; }
    if (tag === 'input' && el.type === 'month') { commitText(el, `${y}-${m}`); return true; }
    if (tag === 'select') return false;
    const fmt = guessFormat(el);
    const maxLen = parseInt(el.getAttribute('maxlength') || '0', 10);
    let v = formatDate(iso, fmt);
    if (maxLen === 8 || (el.getAttribute('inputmode') === 'numeric' && !/[^A-Z]/.test(fmt))) v = v.replace(/[^0-9]/g, '');
    commitText(el, v);
    return true;
  }

  // ---------- radios ----------
  function radioLabel(radio) {
    return norm(`${radio.value} ${labelText(radio)} ${radio.getAttribute('aria-label') || ''} ${radio.id || ''}`);
  }

  function fillRadio(radio, kind) {
    const key = `${kind}:${radio.name || radio.id}`;
    if (seenRadioGroups.has(key)) return false;
    const root = radio.getRootNode();
    const group = radio.name ? Array.from(root.querySelectorAll(`input[type="radio"][name="${radio.name.replace(/"/g, '\\"')}"]`)) : [radio];
    let target = null;
    if (kind === 'sex') {
      const want = fields.sex;
      const tests = want === 'M' ? [/^m$/, /\bmale\b/, /\bman\b/, /\bmr\b/]
        : want === 'F' ? [/^f$/, /\bfemale\b/, /\bwoman\b/, /\bms\b/, /\bmrs\b/]
          : [/^x$/, /\b(other|unspecified|non binary|nonbinary|diverse)\b/];
      for (const re of tests) {
        target = group.find((r) => {
          const lbl = radioLabel(r);
          if (want === 'M' && /\bfemale\b/.test(lbl)) return false;
          return re.test(lbl) || re.test(norm(r.value));
        });
        if (target) break;
      }
    } else if (kind === 'nationality' || kind === 'issuingCountry') {
      const c = fields[kind];
      if (!c) return false;
      const cands = [c.a3, c.a2, c.name, c.demonym, ...(c.aliases || [])].filter(Boolean).map(norm);
      target = group.find((r) => cands.includes(norm(r.value)) || cands.some((x) => x.length > 2 && radioLabel(r).includes(x)));
    }
    if (!target) return false;
    seenRadioGroups.add(key);
    if (!target.checked) target.click();
    fire(target, 'input');
    fire(target, 'change');
    highlight(target.closest('label') || target);
    return true;
  }

  // ---------- main ----------
  const elements = [];
  collect(document, elements);
  const skipTypes = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'file', 'password', 'checkbox', 'range', 'color', 'number']);

  for (const el of elements) {
    const tag = el.tagName.toLowerCase();
    const type = tag === 'input' ? (el.type || 'text').toLowerCase() : tag;
    if (skipTypes.has(type) && type !== 'number') continue;
    if (el.disabled || el.readOnly) continue;
    if (!isVisible(el)) continue;

    let kind = classify(strongDescriptor(el));
    if (!kind) kind = classify(nearbyText(el));
    if (!kind || kind === 'skip') continue;
    if (type === 'number' && kind !== 'dob' && kind !== 'expiry' && kind !== 'passportNumber') continue;
    // Date-typed inputs only ever take a date; a "passport date" field we cannot name is left alone.
    if (['date', 'month', 'week', 'time', 'datetime-local'].includes(type) && kind !== 'dob' && kind !== 'expiry') continue;
    if (type === 'time' || type === 'week' || type === 'datetime-local') continue;

    let ok = false;
    try {
      if (type === 'radio') {
        ok = (kind === 'sex' || kind === 'nationality' || kind === 'issuingCountry') && fillRadio(el, kind);
      } else if (kind === 'dob' || kind === 'expiry') {
        const iso = fields[kind];
        if (iso) ok = fillDate(el, iso, datePart(el));
      } else if (kind === 'sex') {
        const want = fields.sex;
        if (!want) continue;
        if (tag === 'select') {
          const cands = want === 'M' ? ['M', 'male', 'man', 'masculine', 'mr'] : want === 'F' ? ['F', 'female', 'woman', 'feminine', 'ms'] : ['X', 'other', 'unspecified', 'non-binary'];
          const opt = pickOption(el, cands);
          if (opt && !(want === 'M' && /female/i.test(opt.text))) { commitSelect(el, opt); ok = true; }
        } else {
          const maxLen = parseInt(el.getAttribute('maxlength') || '0', 10);
          commitText(el, maxLen === 1 ? want : want === 'M' ? 'Male' : want === 'F' ? 'Female' : 'X');
          ok = true;
        }
      } else if (kind === 'nationality' || kind === 'issuingCountry') {
        const c = fields[kind];
        if (!c) continue;
        if (tag === 'select') {
          const opt = pickOption(el, [c.a3, c.a2, c.name, ...(c.aliases || []), c.demonym]);
          if (opt) { commitSelect(el, opt); ok = true; }
        } else {
          const maxLen = parseInt(el.getAttribute('maxlength') || '0', 10);
          const d = strongDescriptor(el);
          const v = maxLen === 2 ? c.a2 : (maxLen === 3 || /\bcode\b/.test(d)) ? c.a3 : c.name;
          commitText(el, v);
          ok = true;
        }
      } else if (kind === 'fullName') {
        const v = [fields.firstName, fields.lastName].filter(Boolean).join(' ');
        if (v && tag !== 'select') { commitText(el, v); ok = true; }
      } else {
        const v = fields[kind];
        if (v && tag !== 'select') { commitText(el, v); ok = true; }
      }
    } catch (e) {
      ok = false;
    }
    if (ok) filled.push({ field: kind, tag: type, name: el.name || el.id || '' });
  }

  return { count: filled.length, filled, url: location.href, frame: window === window.top ? 'top' : 'iframe' };
}
