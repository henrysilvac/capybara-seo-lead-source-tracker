(function () {
  'use strict';

  if (typeof capysele_config === 'undefined') {
    return;
  }

  const STORAGE_KEY = capysele_config.storageKey || 'capysele_data';
  const FALLBACK_LABEL = capysele_config.fallbackLabel || 'N/D';

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
      captured_at: new Date().toISOString()
    };
  }

  function getStored() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
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

  function saveData(current) {
    const stored = getStored();

    if (!hasAttributionData(current)) {
      return stored;
    }

    const merged = Object.assign({}, stored, current);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  }

  function detectChannel(data) {
    const ch = (capysele_config.channels || {});
    const source = (data.utm_source || '').toLowerCase();
    const medium = (data.utm_medium || '').toLowerCase();

    if (source === 'google' && ['cpc', 'ppc', 'paid'].includes(medium)) {
      return ch.google_ads || 'Google Ads';
    }

    if ((source === 'facebook' || source === 'instagram') && ['cpc', 'ppc', 'paid', 'paid_social'].includes(medium)) {
      return ch.meta_ads || 'Meta Ads';
    }

    if (data.gclid || data.gbraid || data.wbraid) {
      return ch.google_ads || 'Google Ads';
    }

    if (data.fbclid) {
      return ch.meta_ads || 'Meta Ads';
    }

    if (source === 'google' && medium === 'organic') {
      return ch.organic || 'Organic';
    }

    if (medium === 'organic') {
      return ch.organic || 'Organic';
    }

    if (medium === 'referral') {
      return ch.referral || 'Referral';
    }

    if (isSearchEngineReferrer(data.referrer)) {
      return ch.organic || 'Organic';
    }

    if (isExternalReferrer(data.referrer)) {
      return ch.referral || 'Referral';
    }

    return '';
  }

  function normalizeData(data) {
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
      landing_page: data.landing_page || window.location.href,
      captured_at: data.captured_at || new Date().toISOString()
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

    // Reemplazar placeholders restantes
    Object.keys(replacements).forEach(function (placeholder) {
      message = message.split(placeholder).join(replacements[placeholder]);
    });

    return message;
  }

  function resolvePhone(button) {
    const dataPhone = button.getAttribute('data-capysele-phone');
    if (dataPhone) {
      return String(dataPhone).replace(/\D+/g, '');
    }

    return String(capysele_config.phone || '').replace(/\D+/g, '');
  }

  function applyJoinchat(button, data) {
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

      var message = buildMessage(capysele_config.template, data);
      var url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);
      window.open(url, '_blank', 'noopener,noreferrer');

      if (capysele_config.debug) {
        console.log('Capybara SEO Lead Source Tracker: Joinchat interceptado.', { phone: phone, message: message });
      }
    }, true); // capture = true → se ejecuta antes que los handlers de Joinchat

    if (capysele_config.debug) {
      console.log('Capybara SEO Lead Source Tracker: Joinchat listener registrado.', button);
    }
    return true;
  }

  function applyToButtons(data) {
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
      if (applyJoinchat(button, data)) return;

      // Elemento <a> estándar
      if (button.tagName.toLowerCase() !== 'a') {
        if (capysele_config.debug) {
          console.warn('Capybara SEO Lead Source Tracker: el elemento no es <a> ni Joinchat, ignorado.', button);
        }
        return;
      }

      const phone = resolvePhone(button);
      if (!phone) return;

      const message = buildMessage(capysele_config.template, data);
      const url = 'https://wa.me/' + encodeURIComponent(phone) + '?text=' + encodeURIComponent(message);
      button.setAttribute('href', url);
      button.setAttribute('target', '_blank');
      button.setAttribute('rel', 'noopener noreferrer');
    });
  }

  function init() {
    const current = getParams();
    const data = saveData(current);
    applyToButtons(data);

    if (capysele_config.debug) {
      console.log('Capybara SEO Lead Source Tracker data:', data);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
