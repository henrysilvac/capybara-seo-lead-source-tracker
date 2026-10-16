(function () {
  'use strict';

  if (typeof capysele_config === 'undefined') {
    return;
  }

  const STORAGE_KEY = capysele_config.storageKey || 'capysele_data';
  const FALLBACK_LABEL = capysele_config.fallbackLabel || 'N/D';
  const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const ATTRIBUTION_TTL_MS = (function (value) {
    var ms = Number(value);
    return value !== null && isFinite(ms) && ms > 0 ? ms : DEFAULT_TTL_MS;
  })(capysele_config.attributionTtlMs);

  function isExternalReferrer(referrer) {
    if (!referrer) return false;
    try {
      var siteOrigin = new URL(capysele_config.siteUrl).origin;
      var referrerOrigin = new URL(referrer).origin;
      return referrerOrigin !== siteOrigin;
    } catch (e) {
      return false;
    }
  }

  var SEARCH_ENGINE_HOSTS = ['google', 'bing', 'yahoo', 'duckduckgo', 'baidu', 'yandex', 'ecosia'];

  function isSearchEngineReferrer(referrer) {
    if (!referrer) return false;
    try {
      var hostname = new URL(referrer).hostname.toLowerCase();
      var labels = hostname.split('.');
      return SEARCH_ENGINE_HOSTS.some(function (engine) {
        return labels.indexOf(engine) !== -1;
      });
    } catch (e) {
      return false;
    }
  }

  // Plataformas de IA: coincidencia exacta o subdominio (".dominio"), nunca por substring.
  var AI_PLATFORMS = [
    { domains: ['chatgpt.com', 'chat.openai.com'], key: 'ai_chatgpt', label: 'AI - ChatGPT' },
    { domains: ['claude.ai'], key: 'ai_claude', label: 'AI - Claude' },
    { domains: ['gemini.google.com'], key: 'ai_gemini', label: 'AI - Gemini' },
    { domains: ['copilot.microsoft.com'], key: 'ai_copilot', label: 'AI - Copilot' },
    { domains: ['perplexity.ai'], key: 'ai_perplexity', label: 'AI - Perplexity' }
  ];

  function detectAIPlatform(referrer) {
    if (!referrer) return null;
    var url;
    try {
      url = new URL(referrer);
    } catch (e) {
      return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    var hostname = url.hostname.toLowerCase();
    for (var i = 0; i < AI_PLATFORMS.length; i++) {
      var platform = AI_PLATFORMS[i];
      for (var j = 0; j < platform.domains.length; j++) {
        var domain = platform.domains[j];
        if (hostname === domain || hostname.slice(-(domain.length + 1)) === '.' + domain) {
          return platform;
        }
      }
    }
    return null;
  }

  function getParams() {
    const p = new URLSearchParams(window.location.search);
    return {
      utm_source: p.get('utm_source') || '',
      utm_medium: p.get('utm_medium') || '',
      utm_campaign: p.get('utm_campaign') || '',
      utm_content: p.get('utm_content') || '',
      utm_term: p.get('utm_term') || '',
      gclid: p.get('gclid') || '',
      gbraid: p.get('gbraid') || '',
      wbraid: p.get('wbraid') || '',
      fbclid: p.get('fbclid') || '',
      referrer: isExternalReferrer(document.referrer) ? document.referrer : '',
      landing_page: window.location.href,
      captured_at: new Date(Date.now()).toISOString()
    };
  }

  function hasAttributionData(data) {
    return [
      data.utm_source,
      data.utm_medium,
      data.utm_campaign,
      data.utm_content,
      data.utm_term,
      data.gclid,
      data.gbraid,
      data.wbraid,
      data.fbclid,
      data.referrer
    ].some(Boolean);
  }

  // First-touch: la primera captura válida se conserva completa durante
  // ATTRIBUTION_TTL_MS desde su captured_at, sin renovarse por visitas.
  function getExpiresAt(data) {
    var capturedAt = Date.parse(data && data.captured_at);
    return isFinite(capturedAt) ? capturedAt + ATTRIBUTION_TTL_MS : NaN;
  }

  function isValidRecord(data) {
    if (!data || typeof data !== 'object' || !hasAttributionData(data)) return false;
    var capturedAt = Date.parse(data.captured_at);
    var now = Date.now();
    // Fecha ausente, inválida o futura: no hay vigencia determinable.
    return isFinite(capturedAt) && capturedAt <= now && now < capturedAt + ATTRIBUTION_TTL_MS;
  }

  var storageAvailable = true;

  // Devuelve la captura vigente o null. Limpia solo la clave del plugin si
  // el registro venció o no es válido.
  function getValidStored() {
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      storageAvailable = false;
      return null;
    }
    if (raw === null) return null;

    var stored = null;
    try {
      stored = JSON.parse(raw);
    } catch (e) {
      stored = null;
    }
    if (isValidRecord(stored)) return stored;

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      storageAvailable = false;
    }
    return null;
  }

  function saveData(current) {
    const stored = getValidStored();
    if (stored) {
      return stored;
    }

    if (!hasAttributionData(current)) {
      return {};
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (e) {
      storageAvailable = false;
    }
    return current;
  }

  // Atribución efectiva al clic: vuelve a validar la vigencia para que una
  // pestaña abierta más allá del plazo no use una copia vencida, sin
  // recapturar como nueva entrada los parámetros de su carga original.
  function getClickData(pageData) {
    if (storageAvailable) {
      var stored = getValidStored();
      if (storageAvailable) return stored || {};
    }
    // Sin almacenamiento: solo la captura en memoria de esta página, si sigue vigente.
    return isValidRecord(pageData) ? pageData : {};
  }

  function classifyChannel(data) {
    const ch = (capysele_config.channels || {});
    const source = (data.utm_source || '').toLowerCase();
    const medium = (data.utm_medium || '').toLowerCase();

    if (source === 'google' && ['cpc', 'ppc', 'paid'].includes(medium)) {
      return { channel: ch.google_ads || 'Google Ads', reason: 'utm_paid_google' };
    }

    if ((source === 'facebook' || source === 'instagram') && ['cpc', 'ppc', 'paid', 'paid_social'].includes(medium)) {
      return { channel: ch.meta_ads || 'Meta Ads', reason: 'utm_paid_meta' };
    }

    if (data.gclid || data.gbraid || data.wbraid) {
      return { channel: ch.google_ads || 'Google Ads', reason: 'google_click_id' };
    }

    if (data.fbclid) {
      return { channel: ch.meta_ads || 'Meta Ads', reason: 'meta_click_id' };
    }

    if (medium === 'organic') {
      return { channel: ch.organic || 'Organic', reason: 'utm_medium_organic' };
    }

    // Sin click IDs (descartados arriba) y con medio vacío o referral.
    if (!medium || medium === 'referral') {
      var platform = detectAIPlatform(data.referrer);
      if (platform) {
        return { channel: ch[platform.key] || platform.label, reason: 'ai_referrer' };
      }
    }

    if (medium === 'referral') {
      return { channel: ch.referral || 'Referral', reason: 'utm_medium_referral' };
    }

    if (isSearchEngineReferrer(data.referrer)) {
      return { channel: ch.organic || 'Organic', reason: 'search_engine_referrer' };
    }

    if (isExternalReferrer(data.referrer)) {
      return { channel: ch.referral || 'Referral', reason: 'external_referrer' };
    }

    return { channel: '', reason: 'none' };
  }

  function detectChannel(data) {
    return classifyChannel(data).channel;
  }

  function getPageTitle() {
    return String(document.title || '').replace(/\s+/g, ' ').trim();
  }

  function debugInfo(data) {
    var classification = classifyChannel(data);
    var expiresAt = getExpiresAt(data);
    return {
      channel: classification.channel,
      channel_reason: classification.reason,
      captured_at: data.captured_at || '',
      expires_at: isFinite(expiresAt) ? new Date(expiresAt).toISOString() : '',
      data: data
    };
  }

  function normalizeData(data) {
    const clickPage = window.location.href;

    return {
      channel: detectChannel(data) || '',
      utm_source: data.utm_source || FALLBACK_LABEL,
      utm_medium: data.utm_medium || FALLBACK_LABEL,
      utm_campaign: data.utm_campaign || FALLBACK_LABEL,
      utm_content: data.utm_content || FALLBACK_LABEL,
      utm_term: data.utm_term || FALLBACK_LABEL,
      gclid: data.gclid || FALLBACK_LABEL,
      gbraid: data.gbraid || FALLBACK_LABEL,
      wbraid: data.wbraid || FALLBACK_LABEL,
      fbclid: data.fbclid || FALLBACK_LABEL,
      referrer: data.referrer || FALLBACK_LABEL,
      exit_page: clickPage,
      exit_page_title: getPageTitle(),
      landing_page: clickPage,
      captured_at: data.captured_at || new Date(Date.now()).toISOString()
    };
  }

  function buildMessage(template, rawData) {
    const raw = rawData || {};
    const data = normalizeData(raw);

    const replacements = {
      '{channel}': data.channel,
      '{utm_source}': data.utm_source,
      '{utm_medium}': data.utm_medium,
      '{utm_campaign}': data.utm_campaign,
      '{utm_content}': data.utm_content,
      '{utm_term}': data.utm_term,
      '{gclid}': data.gclid,
      '{gbraid}': data.gbraid,
      '{wbraid}': data.wbraid,
      '{fbclid}': data.fbclid,
      '{referrer}': data.referrer,
      '{exit_page}': data.exit_page,
      '{exit_page_title}': data.exit_page_title,
      '{landing_page}': data.landing_page,
      '{captured_at}': data.captured_at
    };

    // Placeholders que dependen de datos capturados (vacíos = eliminar la línea)
    const hasData = {
      '{channel}': !!data.channel,
      '{utm_source}': !!raw.utm_source,
      '{utm_medium}': !!raw.utm_medium,
      '{utm_campaign}': !!raw.utm_campaign,
      '{utm_content}': !!raw.utm_content,
      '{utm_term}': !!raw.utm_term,
      '{gclid}': !!raw.gclid,
      '{gbraid}': !!raw.gbraid,
      '{wbraid}': !!raw.wbraid,
      '{fbclid}': !!raw.fbclid,
      '{referrer}': !!raw.referrer,
      '{exit_page}': true,
      '{exit_page_title}': !!data.exit_page_title,
      '{landing_page}': true,
      '{captured_at}': true
    };

    let message = template || 'Hola, quiero más información.\n\n[canal:{channel}]';

    // Eliminar líneas cuyo placeholder no tenga datos
    var lines = message.split('\n');
    var filtered = [];
    var prevWasBlank = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var skip = false;
      for (var placeholder in hasData) {
        if (line.indexOf(placeholder) !== -1 && !hasData[placeholder]) {
          skip = true;
          break;
        }
      }
      if (skip) continue;
      // Colapsar líneas en blanco consecutivas
      var isBlank = line.trim() === '';
      if (isBlank && prevWasBlank) continue;
      filtered.push(line);
      prevWasBlank = isBlank;
    }
    // Eliminar línea en blanco final
    while (filtered.length && filtered[filtered.length - 1].trim() === '') {
      filtered.pop();
    }
    message = filtered.join('\n');

    // Reemplazar placeholders en una sola pasada: los valores (título, URLs,
    // referente) se insertan como texto literal y no se reinterpretan como
    // placeholders aunque contengan llaves.
    return message.replace(/\{[a-z_]+\}/g, function (placeholder) {
      return Object.prototype.hasOwnProperty.call(replacements, placeholder)
        ? replacements[placeholder]
        : placeholder;
    });
  }

  function resolvePhone(button) {
    const dataPhone = button.getAttribute('data-capysele-phone');
    if (dataPhone) {
      return String(dataPhone).replace(/\D+/g, '');
    }

    return String(capysele_config.phone || '').replace(/\D+/g, '');
  }

  function applyJoinchat(button, pageData) {
    var raw = button.getAttribute('data-settings');
    if (!raw) return false;
    var settings;
    try {
      settings = JSON.parse(raw);
    } catch (e) {
      return false;
    }
    if (!('message_send' in settings)) return false;

    var phone = String(settings.telephone || capysele_config.phone || '').replace(/\D+/g, '');
    if (!phone) return false;

    // Joinchat lee data-settings en su init y lo guarda en memoria,
    // por lo que actualizar el atributo DOM llega tarde.
    // Interceptamos el click en document (capture) para ejecutarnos antes que Joinchat.
    document.addEventListener('click', function (e) {
      if (!button.contains(e.target)) return;

      e.stopImmediatePropagation();
      e.preventDefault();

      var data = getClickData(pageData);
      var message = buildMessage(capysele_config.template, data);
      var url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);
      window.open(url, '_blank', 'noopener,noreferrer');

      if (capysele_config.debug) {
        console.log('Capybara SEO Lead Source Tracker: Joinchat interceptado.', { phone: phone, message: message, attribution: debugInfo(data) });
      }
    }, true); // capture = true → se ejecuta antes que los handlers de Joinchat

    if (capysele_config.debug) {
      console.log('Capybara SEO Lead Source Tracker: Joinchat listener registrado.', button);
    }
    return true;
  }

  function applyToButtons(pageData) {
    // El botón de shortcode siempre está activo; flotante y selector CSS son
    // interruptores independientes y pueden combinarse entre sí.
    var selectorGroups = ['.capysele-button'];
    if (capysele_config.floatingEnabled) {
      selectorGroups.push('.capysele-floating-button');
    }
    if (capysele_config.selectorEnabled && capysele_config.selector) {
      selectorGroups.push(capysele_config.selector);
    }

    var seen = new Set();
    var buttons = [];
    selectorGroups.forEach(function (sel) {
      var found;
      try {
        found = document.querySelectorAll(sel);
      } catch (e) {
        if (capysele_config.debug) {
          console.warn('Capybara SEO Lead Source Tracker: selector inválido, se omite.', sel);
        }
        return;
      }
      found.forEach(function (el) {
        if (!seen.has(el)) {
          seen.add(el);
          buttons.push(el);
        }
      });
    });

    if (!buttons.length) {
      return;
    }

    buttons.forEach(function (button) {
      // Joinchat: elemento con data-settings que contiene message_send
      if (applyJoinchat(button, pageData)) return;

      // Elemento <a> estándar
      if (button.tagName.toLowerCase() !== 'a') {
        if (capysele_config.debug) {
          console.warn('Capybara SEO Lead Source Tracker: el elemento no es <a> ni Joinchat, ignorado.', button);
        }
        return;
      }

      const phone = resolvePhone(button);
      if (!phone) return;

      // Al cargar se usa la captura de la página; al clic se vuelve a validar su vigencia.
      const updateLink = function (event) {
        const data = event ? getClickData(pageData) : pageData;
        const message = buildMessage(capysele_config.template, data);
        const url = 'https://wa.me/' + encodeURIComponent(phone) + '?text=' + encodeURIComponent(message);
        button.setAttribute('href', url);
        button.setAttribute('target', '_blank');
        button.setAttribute('rel', 'noopener noreferrer');
      };

      updateLink();
      button.addEventListener('click', updateLink, true);
    });
  }

  function init() {
    const current = getParams();
    const data = saveData(current);
    applyToButtons(data);

    if (capysele_config.debug) {
      console.log('Capybara SEO Lead Source Tracker data:', debugInfo(data));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
