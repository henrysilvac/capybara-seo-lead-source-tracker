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
  const location = {
    href: options.href,
    search: new URL(options.href).search,
  };

  if (options.storedData) {
    storage.set('capysele_data', JSON.stringify(options.storedData));
  }

  const document = {
    readyState: 'complete',
    referrer: options.referrer || '',
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

  const context = vm.createContext({
    Date,
    JSON,
    Object,
    Set,
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
      log() {},
      warn() {},
    },
    document,
    encodeURIComponent,
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
    },
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
    location,
    openedUrls,
    storedValue() {
      const value = storage.get('capysele_data');
      return value ? JSON.parse(value) : null;
    },
  };
}

function messageFromUrl(url) {
  return new URL(url).searchParams.get('text');
}

const firstTouchData = {
  utm_source: 'google',
  utm_medium: 'cpc',
  utm_campaign: 'home-campaign',
  gclid: 'FirstClick123',
  referrer: 'https://google.com/search?q=capybara',
  landing_page: 'https://example.test/?utm_source=google&utm_medium=cpc',
  captured_at: '2026-08-20T12:00:00.000Z',
};

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
      const button = new FakeElement('a', {
        href: 'https://wa.me/15550101234',
        'data-capysele-phone': '15550101234',
      });
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
  const button = new FakeElement('a', {
    href: 'https://wa.me/15550101234',
    'data-capysele-phone': '15550101234',
  });
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
  const button = new FakeElement('div', {
    'data-settings': JSON.stringify({
      telephone: '15550101234',
      message_send: 'Joinchat fallback',
    }),
  });
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
