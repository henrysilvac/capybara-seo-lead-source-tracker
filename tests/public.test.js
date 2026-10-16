'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const publicScript = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'public.js'),
  'utf8'
);

const DAY_MS = 24 * 60 * 60 * 1000;
const TTL_MS = 7 * DAY_MS;
// Reloj fijo: las pruebas no dependen del día real de ejecución.
const NOW = Date.parse('2026-10-16T15:00:00.000Z');

function isoAt(ms) {
  return new Date(ms).toISOString();
}

class FakeElement {
  constructor(tagName, attributes) {
    this.tagName = tagName.toUpperCase();
    this.attributes = Object.assign({}, attributes);
    this.listeners = {};
  }

  addEventListener(type, listener) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(listener);
  }

  contains(target) {
    return target === this;
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name)
      ? this.attributes[name]
      : null;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
}

function createRuntime(options) {
  const storage = new Map();
  const documentListeners = {};
  const openedUrls = [];
  const logs = [];
  const location = {
    href: options.href,
    search: new URL(options.href).search,
  };
  const clock = { now: options.now === undefined ? NOW : options.now };

  class FakeDate extends Date {
    constructor(...args) {
      if (args.length === 0) {
        super(clock.now);
      } else {
        super(...args);
      }
    }

    static now() {
      return clock.now;
    }
  }

  if (options.storedData !== undefined) {
    storage.set(
      'capysele_data',
      typeof options.storedData === 'string'
        ? options.storedData
        : JSON.stringify(options.storedData)
    );
  }
  Object.entries(options.otherStorage || {}).forEach(([key, value]) => {
    storage.set(key, value);
  });

  const document = {
    readyState: 'complete',
    referrer: options.referrer || '',
    title: options.title === undefined ? 'Product A | Example' : options.title,
    addEventListener(type, listener) {
      documentListeners[type] = documentListeners[type] || [];
      documentListeners[type].push(listener);
    },
    querySelectorAll(selector) {
      return options.elementsBySelector[selector] || [];
    },
  };

  const window = {
    location,
    open(url) {
      openedUrls.push(url);
    },
  };

  const localStorage = options.storageUnavailable
    ? {
      getItem() { throw new Error('SecurityError'); },
      setItem() { throw new Error('SecurityError'); },
      removeItem() { throw new Error('SecurityError'); },
    }
    : {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    };

  const context = vm.createContext({
    Date: FakeDate,
    JSON,
    Number,
    Object,
    Set,
    String,
    URL,
    URLSearchParams,
    capysele_config: Object.assign({
      phone: '15550101234',
      template: 'page:{exit_page}\nlegacy:{landing_page}\nsource:{utm_source}',
      floatingEnabled: false,
      selectorEnabled: false,
      selector: '.tracked',
      storageKey: 'capysele_data',
      siteUrl: 'https://example.test/',
      fallbackLabel: 'N/A',
      channels: {},
      debug: false,
    }, options.config),
    console: {
      log(...args) { logs.push(args); },
      warn(...args) { logs.push(args); },
    },
    document,
    encodeURIComponent,
    localStorage,
    window,
  });

  vm.runInContext(publicScript, context, { filename: 'public/public.js' });

  return {
    click(element) {
      const event = {
        target: element,
        defaultPrevented: false,
        immediatePropagationStopped: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        stopImmediatePropagation() {
          this.immediatePropagationStopped = true;
        },
      };

      for (const listener of documentListeners.click || []) {
        listener(event);
        if (event.immediatePropagationStopped) return event;
      }
      for (const listener of element.listeners.click || []) {
        listener(event);
        if (event.immediatePropagationStopped) break;
      }
      return event;
    },
    clock,
    document,
    location,
    logs,
    openedUrls,
    storage,
    storedValue() {
      const value = storage.get('capysele_data');
      return value ? JSON.parse(value) : null;
    },
  };
}

function messageFromUrl(url) {
  return new URL(url).searchParams.get('text');
}

function linkButton() {
  return new FakeElement('a', {
    href: 'https://wa.me/15550101234',
    'data-capysele-phone': '15550101234',
  });
}

function joinchatButton() {
  return new FakeElement('div', {
    'data-settings': JSON.stringify({
      telephone: '15550101234',
      message_send: 'Joinchat fallback',
    }),
  });
}

// Carga una página con un botón de shortcode, hace clic y devuelve el mensaje.
function loadAndClick(options) {
  const button = linkButton();
  const runtime = createRuntime(Object.assign({
    href: 'https://example.test/',
    elementsBySelector: { '.capysele-button': [button] },
  }, options));
  runtime.click(button);
  return {
    runtime,
    button,
    message: messageFromUrl(button.getAttribute('href')),
  };
}

const firstTouchData = {
  utm_source: 'google',
  utm_medium: 'cpc',
  utm_campaign: 'home-campaign',
  gclid: 'FirstClick123',
  referrer: 'https://google.com/search?q=capybara',
  landing_page: 'https://example.test/?utm_source=google&utm_medium=cpc',
  captured_at: isoAt(NOW - DAY_MS),
};

function aiRecord(referrer, capturedAt) {
  return {
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_content: '',
    utm_term: '',
    gclid: '',
    gbraid: '',
    wbraid: '',
    fbclid: '',
    referrer,
    landing_page: 'https://example.test/',
    captured_at: isoAt(capturedAt === undefined ? NOW - DAY_MS : capturedAt),
  };
}

const CHANNEL_TEMPLATE = 'channel:{channel}\nsource:{utm_source}\nmedium:{utm_medium}\nref:{referrer}';

/* ------------------------------------------------------------------ */
/* Contrato existente de URL de clic y tipos de botón                  */
/* ------------------------------------------------------------------ */

test('standard tracked links resolve both page placeholders at the actual click', async (t) => {
  const placements = [
    {
      name: 'shortcode',
      selector: '.capysele-button',
      config: {},
    },
    {
      name: 'floating button',
      selector: '.capysele-floating-button',
      config: { floatingEnabled: true },
    },
    {
      name: 'CSS selector',
      selector: '.tracked',
      config: { selectorEnabled: true },
    },
  ];

  for (const placement of placements) {
    await t.test(placement.name, () => {
      const button = linkButton();
      const runtime = createRuntime({
        href: 'https://example.test/product-a',
        storedData: firstTouchData,
        elementsBySelector: { [placement.selector]: [button] },
        config: placement.config,
      });

      const clickUrl = 'https://example.test/product-b?variant=blue#details';
      runtime.location.href = clickUrl;
      runtime.location.search = '?variant=blue';
      runtime.click(button);

      const message = messageFromUrl(button.getAttribute('href'));
      assert.ok(message.includes(`page:${clickUrl}`));
      assert.ok(message.includes(`legacy:${clickUrl}`));
      assert.match(message, /source:google/);
      assert.deepEqual(runtime.storedValue(), firstTouchData);
    });
  }
});

test('legacy-only templates use the full click URL for direct traffic', () => {
  const button = linkButton();
  const runtime = createRuntime({
    href: 'https://example.test/product-a',
    elementsBySelector: { '.capysele-button': [button] },
    config: { template: 'legacy:{landing_page}\nsource:{utm_source}' },
  });

  runtime.location.href = 'https://example.test/product?coupon=summer#buy';
  runtime.location.search = '?coupon=summer';
  runtime.click(button);

  assert.equal(
    messageFromUrl(button.getAttribute('href')),
    'legacy:https://example.test/product?coupon=summer#buy'
  );
  assert.equal(runtime.storedValue(), null);
});

test('Joinchat resolves both page placeholders inside its capture-phase click handler', () => {
  const button = joinchatButton();
  const runtime = createRuntime({
    href: 'https://example.test/product-a',
    storedData: firstTouchData,
    elementsBySelector: { '.joinchat': [button] },
    config: {
      selector: '.joinchat',
      selectorEnabled: true,
    },
  });

  const clickUrl = 'https://example.test/product-b?variant=green#contact';
  runtime.location.href = clickUrl;
  runtime.location.search = '?variant=green';
  const event = runtime.click(button);

  assert.equal(event.defaultPrevented, true);
  assert.equal(runtime.openedUrls.length, 1);
  const message = messageFromUrl(runtime.openedUrls[0]);
  assert.match(message, /page:https:\/\/example\.test\/product-b\?variant=green#contact/);
  assert.match(message, /legacy:https:\/\/example\.test\/product-b\?variant=green#contact/);
  assert.match(message, /source:google/);
  assert.deepEqual(runtime.storedValue(), firstTouchData);
});

/* ------------------------------------------------------------------ */
/* T1 — First-touch con vencimiento de siete días                       */
/* ------------------------------------------------------------------ */

test('first-touch: a valid capture is kept intact against new UTMs, click IDs and referrers', async (t) => {
  const entries = [
    { name: 'new UTMs', href: 'https://example.test/?utm_source=facebook&utm_medium=paid&utm_campaign=late' },
    { name: 'new gclid', href: 'https://example.test/?gclid=LateClick' },
    { name: 'new fbclid', href: 'https://example.test/?fbclid=LateFb' },
    { name: 'new external referrer', href: 'https://example.test/', referrer: 'https://www.bing.com/' },
  ];

  for (const entry of entries) {
    await t.test(entry.name, () => {
      const { runtime, message } = loadAndClick({
        href: entry.href,
        referrer: entry.referrer,
        storedData: firstTouchData,
        config: { template: CHANNEL_TEMPLATE + '\ncampaign:{utm_campaign}\ngclid:{gclid}' },
      });

      assert.deepEqual(runtime.storedValue(), firstTouchData);
      assert.match(message, /channel:Google Ads/);
      assert.match(message, /source:google/);
      assert.match(message, /campaign:home-campaign/);
      assert.match(message, /gclid:FirstClick123/);
    });
  }
});

test('first-touch: a visit without signals stores nothing and does not block a later identifiable entry', () => {
  const first = loadAndClick({ href: 'https://example.test/' });
  assert.equal(first.runtime.storedValue(), null);

  const later = loadAndClick({
    href: 'https://example.test/?utm_source=newsletter&utm_medium=email',
    config: { template: CHANNEL_TEMPLATE },
  });
  const stored = later.runtime.storedValue();
  assert.equal(stored.utm_source, 'newsletter');
  assert.equal(stored.utm_medium, 'email');
  assert.equal(stored.captured_at, isoAt(NOW));
});

test('first-touch: a new capture replaces an expired record as a whole set, without merging fields', () => {
  const expired = Object.assign({}, firstTouchData, { captured_at: isoAt(NOW - TTL_MS - 1) });
  const { runtime } = loadAndClick({
    href: 'https://example.test/?utm_source=newsletter&utm_medium=email',
    storedData: expired,
  });
  const stored = runtime.storedValue();
  assert.equal(stored.utm_source, 'newsletter');
  assert.equal(stored.gclid, '');
  assert.equal(stored.utm_campaign, '');
  assert.equal(stored.referrer, '');
  assert.equal(stored.captured_at, isoAt(NOW));
});

test('first-touch: visits inside the window never renew captured_at', () => {
  const record = Object.assign({}, firstTouchData, { captured_at: isoAt(NOW - 6 * DAY_MS) });
  const { runtime } = loadAndClick({
    href: 'https://example.test/?utm_source=google&utm_medium=cpc&gclid=Again',
    storedData: record,
  });
  assert.equal(runtime.storedValue().captured_at, record.captured_at);
});

test('expiry: the record is valid just before the limit and expires exactly at it', async (t) => {
  await t.test('one millisecond before the limit', () => {
    const record = Object.assign({}, firstTouchData, { captured_at: isoAt(NOW - TTL_MS + 1) });
    const { runtime, message } = loadAndClick({
      storedData: record,
      config: { template: CHANNEL_TEMPLATE },
    });
    assert.match(message, /channel:Google Ads/);
    assert.deepEqual(runtime.storedValue(), record);
  });

  for (const [name, offset] of [['exactly at the limit', 0], ['after the limit', 1]]) {
    await t.test(name, () => {
      const record = Object.assign({}, firstTouchData, { captured_at: isoAt(NOW - TTL_MS - offset) });
      const { runtime, message } = loadAndClick({
        storedData: record,
        otherStorage: { unrelated_key: 'keep-me' },
        config: { template: CHANNEL_TEMPLATE },
      });
      assert.equal(message, '');
      assert.equal(runtime.storedValue(), null);
      assert.equal(runtime.storage.get('unrelated_key'), 'keep-me');
    });
  }
});

test('expiry: without a valid record or new signals no source is invented', () => {
  const record = Object.assign({}, aiRecord('https://chatgpt.com/'), { captured_at: isoAt(NOW - 8 * DAY_MS) });
  const { message, runtime } = loadAndClick({
    storedData: record,
    config: { template: 'Hola\nchannel:{channel}\nsource:{utm_source}' },
  });
  assert.equal(message, 'Hola');
  assert.equal(runtime.storedValue(), null);
});

test('expiry: a new identifiable entry after expiry starts a new first-touch window', () => {
  const record = Object.assign({}, aiRecord('https://chatgpt.com/'), { captured_at: isoAt(NOW - 8 * DAY_MS) });
  const { message, runtime } = loadAndClick({
    href: 'https://example.test/',
    referrer: 'https://www.google.com/',
    storedData: record,
    config: { template: CHANNEL_TEMPLATE },
  });
  assert.match(message, /channel:Organic/);
  assert.equal(runtime.storedValue().referrer, 'https://www.google.com/');
  assert.equal(runtime.storedValue().captured_at, isoAt(NOW));
});

test('expiry: clicking in a tab left open past the limit drops the record without recapturing page-load params', async (t) => {
  const placements = [
    { name: 'shortcode link', make: linkButton, selector: '.capysele-button', config: {} },
    { name: 'Joinchat', make: joinchatButton, selector: '.joinchat', config: { selector: '.joinchat', selectorEnabled: true } },
  ];

  for (const placement of placements) {
    await t.test(placement.name, () => {
      const button = placement.make();
      const runtime = createRuntime({
        href: 'https://example.test/?utm_source=google&utm_medium=cpc&gclid=LoadClick',
        elementsBySelector: { [placement.selector]: [button] },
        config: Object.assign({ template: CHANNEL_TEMPLATE }, placement.config),
      });
      assert.equal(runtime.storedValue().gclid, 'LoadClick');

      runtime.clock.now = NOW + TTL_MS;
      runtime.click(button);

      const url = placement.name === 'Joinchat' ? runtime.openedUrls[0] : button.getAttribute('href');
      assert.equal(messageFromUrl(url), '');
      assert.equal(runtime.storedValue(), null);
    });
  }
});

test('expiry: legacy records are judged by their original captured_at', async (t) => {
  await t.test('valid legacy record is kept', () => {
    const record = Object.assign({}, firstTouchData, { captured_at: '2026-10-12T09:30:00.000Z' });
    const { runtime } = loadAndClick({ storedData: record });
    assert.deepEqual(runtime.storedValue(), record);
  });

  const invalid = [
    ['missing captured_at', (() => { const r = Object.assign({}, firstTouchData); delete r.captured_at; return r; })()],
    ['unparseable captured_at', Object.assign({}, firstTouchData, { captured_at: 'yesterday' })],
    ['future captured_at', Object.assign({}, firstTouchData, { captured_at: isoAt(NOW + DAY_MS) })],
    ['expired legacy record', Object.assign({}, firstTouchData, { captured_at: '2020-01-01T00:00:00.000Z' })],
    ['corrupt JSON', '{not json'],
    ['record without attribution signals', { landing_page: 'https://example.test/', captured_at: isoAt(NOW - DAY_MS) }],
  ];

  for (const [name, record] of invalid) {
    await t.test(`${name} is discarded and not renewed`, () => {
      const { runtime, message } = loadAndClick({
        storedData: record,
        config: { template: CHANNEL_TEMPLATE },
      });
      assert.equal(message, '');
      assert.equal(runtime.storedValue(), null);
    });
  }
});

test('expiry: the retention period comes from capysele_config with a 7-day fallback', async (t) => {
  await t.test('custom duration from PHP is honored', () => {
    const record = Object.assign({}, firstTouchData, { captured_at: isoAt(NOW - 2 * 60 * 60 * 1000) });
    const { runtime } = loadAndClick({
      storedData: record,
      config: { attributionTtlMs: 60 * 60 * 1000 },
    });
    assert.equal(runtime.storedValue(), null);
  });

  await t.test('numeric string from wp_localize_script is honored', () => {
    const record = Object.assign({}, firstTouchData, { captured_at: isoAt(NOW - 2 * 60 * 60 * 1000) });
    const { runtime } = loadAndClick({
      storedData: record,
      config: { attributionTtlMs: String(60 * 60 * 1000) },
    });
    assert.equal(runtime.storedValue(), null);
  });

  for (const bad of ['abc', '', -5, 0, null, Infinity]) {
    await t.test(`invalid value ${String(bad)} falls back to 7 days`, () => {
      const keep = Object.assign({}, firstTouchData, { captured_at: isoAt(NOW - 6 * DAY_MS) });
      const kept = loadAndClick({ storedData: keep, config: { attributionTtlMs: bad } });
      assert.deepEqual(kept.runtime.storedValue(), keep);

      const drop = Object.assign({}, firstTouchData, { captured_at: isoAt(NOW - TTL_MS) });
      const dropped = loadAndClick({ storedData: drop, config: { attributionTtlMs: bad } });
      assert.equal(dropped.runtime.storedValue(), null);
    });
  }
});

test('capture: empty parameters do not create attribution', () => {
  const { runtime, message } = loadAndClick({
    href: 'https://example.test/?utm_source=&utm_medium=&gclid=',
    config: { template: CHANNEL_TEMPLATE },
  });
  assert.equal(runtime.storedValue(), null);
  assert.equal(message, '');
});

test('capture: unavailable localStorage still attributes the current page without throwing', () => {
  const { message } = loadAndClick({
    href: 'https://example.test/?utm_source=google&utm_medium=cpc',
    storageUnavailable: true,
    config: { template: CHANNEL_TEMPLATE },
  });
  assert.match(message, /channel:Google Ads/);
});

test('debug: logs capture date, expiry and the reason for the effective channel', () => {
  const { runtime } = loadAndClick({
    storedData: firstTouchData,
    config: { debug: true },
  });
  const entry = runtime.logs.find((args) => args[1] && args[1].channel_reason);
  assert.ok(entry, 'expected a debug entry with channel_reason');
  assert.equal(entry[1].channel, 'Google Ads');
  assert.equal(entry[1].channel_reason, 'utm_paid_google');
  assert.equal(entry[1].captured_at, firstTouchData.captured_at);
  assert.equal(entry[1].expires_at, isoAt(Date.parse(firstTouchData.captured_at) + TTL_MS));
});

/* ------------------------------------------------------------------ */
/* T2 — Título de la página de clic                                     */
/* ------------------------------------------------------------------ */

test('{exit_page_title} resolves document.title at click time on every button type', async (t) => {
  const placements = [
    { name: 'shortcode', make: linkButton, selector: '.capysele-button', config: {} },
    { name: 'floating button', make: linkButton, selector: '.capysele-floating-button', config: { floatingEnabled: true } },
    { name: 'CSS selector', make: linkButton, selector: '.tracked', config: { selectorEnabled: true } },
    { name: 'Joinchat', make: joinchatButton, selector: '.joinchat', config: { selector: '.joinchat', selectorEnabled: true } },
  ];

  for (const placement of placements) {
    await t.test(placement.name, () => {
      const button = placement.make();
      const runtime = createRuntime({
        href: 'https://example.test/product-a',
        title: 'Product A | Example',
        storedData: firstTouchData,
        elementsBySelector: { [placement.selector]: [button] },
        config: Object.assign({ template: 'Página:{exit_page_title}\nurl:{exit_page}' }, placement.config),
      });

      runtime.document.title = 'Product B — Módulos prefabricados | Example';
      runtime.location.href = 'https://example.test/product-b';
      runtime.click(button);

      const url = placement.name === 'Joinchat' ? runtime.openedUrls[0] : button.getAttribute('href');
      assert.equal(
        messageFromUrl(url),
        'Página:Product B — Módulos prefabricados | Example\nurl:https://example.test/product-b'
      );
      assert.deepEqual(runtime.storedValue(), firstTouchData);
    });
  }
});

test('{exit_page_title}: an empty title removes its line', () => {
  for (const title of ['', '   \n  ']) {
    const { message } = loadAndClick({
      title,
      config: { template: 'Hola\n[Página:{exit_page_title}]\nurl:{exit_page}' },
    });
    assert.equal(message, 'Hola\nurl:https://example.test/');
  }
});

test('{exit_page_title}: whitespace is normalized and special text stays literal', () => {
  const { message } = loadAndClick({
    title: '  Oferta 🎉\n  ñandú   $& $1 {channel} [x]  ',
    storedData: firstTouchData,
    config: { template: 'A:{exit_page_title}\nB:{exit_page_title}\nchannel:{channel}' },
  });
  assert.equal(
    message,
    'A:Oferta 🎉 ñandú $& $1 {channel} [x]\nB:Oferta 🎉 ñandú $& $1 {channel} [x]\nchannel:Google Ads'
  );
});

test('{exit_page_title}: templates without it are unchanged and reading it never writes storage', () => {
  const { message, runtime } = loadAndClick({
    title: 'Some title',
    config: { template: 'legacy:{landing_page}' },
  });
  assert.equal(message, 'legacy:https://example.test/');
  assert.equal(runtime.storedValue(), null);
});

/* ------------------------------------------------------------------ */
/* T3 — Plataformas de IA                                               */
/* ------------------------------------------------------------------ */

const AI_LABELS = {
  ai_chatgpt: 'IA - ChatGPT',
  ai_claude: 'IA - Claude',
  ai_gemini: 'IA - Gemini',
  ai_copilot: 'IA - Copilot',
  ai_perplexity: 'IA - Perplexity',
  organic: 'Orgánico',
  referral: 'Referido',
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
};

function channelFor(options) {
  const { message } = loadAndClick(Object.assign({
    config: { template: 'channel:{channel}', channels: AI_LABELS },
  }, options));
  return message.replace(/^channel:/, '');
}

test('AI: each platform is detected by exact domain and subdomain', async (t) => {
  const cases = [
    ['https://chatgpt.com/', 'IA - ChatGPT'],
    ['https://www.chatgpt.com/c/abc', 'IA - ChatGPT'],
    ['https://chat.openai.com/', 'IA - ChatGPT'],
    ['https://claude.ai/chat/1', 'IA - Claude'],
    ['https://www.claude.ai/', 'IA - Claude'],
    ['https://gemini.google.com/app', 'IA - Gemini'],
    ['https://copilot.microsoft.com/', 'IA - Copilot'],
    ['https://www.perplexity.ai/search?q=x', 'IA - Perplexity'],
    ['https://PERPLEXITY.AI/', 'IA - Perplexity'],
  ];
  for (const [referrer, expected] of cases) {
    await t.test(referrer, () => {
      assert.equal(channelFor({ referrer }), expected);
    });
  }
});

test('AI: lookalike, invalid and non-HTTP referrers do not match', async (t) => {
  const cases = [
    ['https://chatgpt.com.example.org/', 'Referido'],
    ['https://fakechatgpt.com/', 'Referido'],
    ['https://notclaude.ai/', 'Referido'],
    ['https://www.google.com/', 'Orgánico'],
  ];
  for (const [referrer, expected] of cases) {
    await t.test(referrer, () => {
      assert.equal(channelFor({ referrer }), expected);
    });
  }

  await t.test('non-HTTP referrer', () => {
    assert.equal(channelFor({ referrer: 'android-app://chatgpt.com/' }), 'Referido');
  });
});

test('AI: falls back to English labels when PHP does not send them', () => {
  const { message } = loadAndClick({
    referrer: 'https://claude.ai/',
    config: { template: 'channel:{channel}' },
  });
  assert.equal(message, 'channel:AI - Claude');
});

test('AI: precedence against UTMs and click IDs within the same capture', async (t) => {
  const cases = [
    ['', 'IA - ChatGPT'],
    ['?utm_medium=referral&utm_source=chatgpt.com', 'IA - ChatGPT'],
    ['?utm_source=chatgpt.com', 'IA - ChatGPT'],
    ['?utm_medium=organic', 'Orgánico'],
    ['?utm_source=google&utm_medium=cpc', 'Google Ads'],
    ['?utm_source=facebook&utm_medium=paid', 'Meta Ads'],
    ['?utm_medium=cpc', 'Referido'],
    ['?utm_medium=email', 'Referido'],
    ['?gclid=x', 'Google Ads'],
    ['?gbraid=x', 'Google Ads'],
    ['?wbraid=x', 'Google Ads'],
    ['?fbclid=x', 'Meta Ads'],
  ];
  for (const [query, expected] of cases) {
    await t.test(query || 'no parameters', () => {
      assert.equal(
        channelFor({ href: 'https://example.test/' + query, referrer: 'https://chatgpt.com/' }),
        expected
      );
    });
  }
});

test('AI: a first-touch AI capture survives a later Google entry and a later paid campaign', async (t) => {
  for (const [name, href, referrer] of [
    ['later Google organic entry', 'https://example.test/', 'https://www.google.com/'],
    ['later paid campaign', 'https://example.test/?utm_source=google&utm_medium=cpc&gclid=Late', ''],
  ]) {
    await t.test(name, () => {
      const record = aiRecord('https://chatgpt.com/');
      const { message, runtime } = loadAndClick({
        href,
        referrer,
        storedData: record,
        config: { template: 'channel:{channel}', channels: AI_LABELS },
      });
      assert.equal(message, 'channel:IA - ChatGPT');
      assert.deepEqual(runtime.storedValue(), record);
    });
  }
});

test('AI: a first-touch Google capture stays Organic when a later visit comes from AI', () => {
  const record = aiRecord('https://www.google.com/');
  const { message, runtime } = loadAndClick({
    referrer: 'https://chatgpt.com/',
    storedData: record,
    config: { template: 'channel:{channel}', channels: AI_LABELS },
  });
  assert.equal(message, 'channel:Orgánico');
  assert.deepEqual(runtime.storedValue(), record);
});

test('regression: AI on an earlier day → return without signals → internal page → WhatsApp keeps AI', () => {
  const record = aiRecord('https://chatgpt.com/', NOW - 3 * DAY_MS);

  // Retorno sin referente ni parámetros.
  const visit = loadAndClick({ href: 'https://example.test/', storedData: record });
  assert.deepEqual(visit.runtime.storedValue(), record);

  // Navegación interna y clic.
  const button = joinchatButton();
  const runtime = createRuntime({
    href: 'https://example.test/servicios',
    referrer: 'https://example.test/',
    storedData: visit.runtime.storedValue(),
    elementsBySelector: { '.joinchat': [button] },
    config: {
      selector: '.joinchat',
      selectorEnabled: true,
      template: '[Página:{exit_page_title}]\n[canal:{channel}]',
      channels: AI_LABELS,
    },
    title: 'Servicios | Calytec',
  });
  runtime.click(button);
  assert.equal(messageFromUrl(runtime.openedUrls[0]), '[Página:Servicios | Calytec]\n[canal:IA - ChatGPT]');
  assert.deepEqual(runtime.storedValue(), record);
});
