=== Capybara SEO Lead Source Tracker ===
Contributors: capybaraseo
Donate link: https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=paypal@ilmaistro.pe&currency_code=USD
Tags: whatsapp, utm, tracking, leads, attribution
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.8.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Author URI: https://seo.pe

Captures UTMs and click IDs and adds them to your WhatsApp messages via a floating button, existing buttons, or a shortcode.

== Description ==

Capybara SEO Lead Source Tracker captures UTM parameters and click IDs (gclid, gbraid, wbraid, fbclid) from the URL, stores them in localStorage (first-touch attribution, kept for 7 days by default from the initial capture), and automatically updates WhatsApp links with a dynamic message that includes the lead source data.

**Key features:**

* Captures utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, gbraid, wbraid, fbclid
* First-touch attribution: the first identifiable visit is preserved across pages and later visits for 7 days by default, counted from the initial capture — later visits and campaigns don't replace it or restart the period
* Automatic channel detection: Google Ads, Meta Ads, Organic, Referral, and AI platforms (ChatGPT, Claude, Gemini, Copilot, Perplexity)
* Lines with no captured data are omitted from the WhatsApp message
* Combinable button placements: Floating button (auto-injected, zero setup) and CSS Selector (reuse existing buttons) can both be turned on at once, plus the always-available [capysele_button] shortcode — all sharing the same number and tracking
* Customizable message template with placeholders
* Click-time page tracking: {exit_page} reports the complete URL where the visitor clicks, including its query string and fragment, and {exit_page_title} reports that page's title
* Translation-ready: approved locales are delivered separately through WordPress.org language packs based on the WordPress site or user locale
* Debug mode: logs captured data, its capture and expiry dates, and why the channel was assigned to the browser console

**Available placeholders for the message template:**

{channel}, {utm_source}, {utm_medium}, {utm_campaign}, {utm_content}, {utm_term}, {gclid}, {gbraid}, {wbraid}, {fbclid}, {referrer}, {exit_page}, {exit_page_title}, {landing_page}, {captured_at}

Use {exit_page} for new templates. The legacy {landing_page} placeholder remains supported and now returns the same click-time URL for backward compatibility. Use {exit_page_title} for the title of the page where the visitor clicks (read at click time); you can use the title, the URL, or both. Existing templates are not changed automatically.

== Installation ==

1. Upload the plugin zip from Plugins > Add New > Upload Plugin.
2. Activate the plugin.
3. Go to Settings > Capybara SEO Lead Source Tracker.
4. Set your WhatsApp number and message template.
5. Turn on "Floating button" for a ready-to-use button with no further setup, and/or turn on "CSS Selector" with the CSS class of an existing button to add tracking to it — both can be enabled together. The [capysele_button] shortcode is always available regardless of these toggles.
6. Test with a URL containing UTM parameters, e.g. ?utm_source=google&utm_medium=cpc&utm_campaign=test

== Screenshots ==

1. Configure the receiving number and choose one or more button placements.
2. Customize the message template with first-touch attribution placeholders.
3. Display the tracked floating button and shortcode button on a WordPress page.
4. Send a prefilled WhatsApp message containing the captured lead-source data.

== Frequently Asked Questions ==

= Does it work with any WhatsApp button? =

Yes. Enable "CSS Selector" and set the selector to match your existing buttons (e.g. a[href*="wa.me"]) and the plugin will update their href automatically. This can be combined with the floating button at the same time.

= What is first-touch attribution? =

The first identifiable visit (UTM parameters, click IDs, or an external referrer) is stored in the visitor's browser and kept as a complete set while they navigate to other pages or come back later. Later visits and campaigns do not replace it. This way, the original traffic source is preserved in the WhatsApp message.

= How long is attribution kept? =

First-touch attribution is kept in this browser's local storage for 7 days by default, counted from the initial capture. Later visits and campaigns don't replace the source or restart the period. Once it expires, the plugin stops using that record and deletes it the next time it runs; a new identifiable visit can then start a new attribution period.

Attribution is stored per browser and device; it does not identify the same visitor across devices. {captured_at} shows the date of the initial capture, not of the current visit. Visits with no UTMs, click IDs or external referrer are not labeled as Organic — no channel is assigned.

= How are AI platforms detected? =

When the first captured visit comes from chatgpt.com, chat.openai.com, claude.ai, gemini.google.com, copilot.microsoft.com, or perplexity.ai (including their subdomains), the channel is reported as "AI - ChatGPT", "AI - Claude", and so on. Paid UTMs, click IDs, and utm_medium=organic take priority; AI is assigned only when there is no click ID and utm_medium is empty or "referral". Lookalike domains (e.g. chatgpt.com.example.org) are not matched.

= What happens if a field has no data? =

Lines in the message template whose placeholder has no captured value are automatically removed from the WhatsApp message.

== Upgrade Notice ==

= 0.8.0 =
First-touch attribution now expires 7 days after the initial capture and is no longer replaced by later visits. Adds AI platform channels and the {exit_page_title} placeholder. Saved templates are not changed.

= 0.7.1 =
Adds {exit_page} for the complete click-time URL. Existing {landing_page} templates remain compatible and now receive that same URL; saved attribution data and settings require no migration.

== Changelog ==

= 0.8.0 =
* Added AI platform channels detected from the referrer domain: ChatGPT (chatgpt.com, chat.openai.com), Claude, Gemini, Copilot, and Perplexity. Paid UTMs, click IDs, and utm_medium=organic keep priority; lookalike domains are not matched.
* Added {exit_page_title}, the title of the page where the visitor clicks, read at click time on the shortcode, floating button, CSS-selector links, and Joinchat.
* Fixed first-touch attribution: the first identifiable visit is now kept as a complete set instead of being replaced by later UTMs, click IDs, or referrers.
* First-touch attribution now expires 7 days after the initial capture (not renewed by later visits). Expired, undated, or future-dated records are ignored and removed from localStorage; other storage keys are untouched. Clicks in a tab left open past the limit no longer use the expired record.
* Placeholder values (titles, URLs, referrers) are now inserted literally and never re-interpreted as placeholders.
* Debug mode now logs the capture date, expiry date, and the reason for the assigned channel.
* The plugin keeps working for the current page when localStorage is unavailable.

= 0.7.1 =
* Added {exit_page}, the recommended placeholder for the complete URL at the moment a visitor clicks, including query strings and fragments.
* Changed the legacy {landing_page} placeholder to return the same click-time URL while preserving compatibility with existing message templates.
* Preserved first-touch UTM, click ID, and referrer attribution without changing saved settings or clearing capysele_data.
* Corrected the readme Features list, which still described bundled English/Spanish translations after 0.7.0 removed the bundled .po/.mo files; it now describes translations as delivered through WordPress.org language packs.

= 0.7.0 =
* Renamed internal PHP/JS/CSS identifiers (constants, classes, option key, shortcode, script/style handles, JS global, localStorage key, CSS classes) from the `wa_ls`/`WA_LS`/`wa-ls` prefix to `capysele`, per WordPress.org review feedback that the old prefix (inherited from an earlier codename) wasn't distinctive. The shortcode is now [capysele_button].
* readme.txt Description, Installation and FAQ are now English-only, per WordPress.org guidelines. Spanish content in the plugin UI itself is unaffected — it's still handled via standard WordPress i18n.
* Removed the bundled es_ES .po/.mo translation files from the package; translations are now handled via translate.wordpress.org once the plugin is live.
* Removed the now-unnecessary load_plugin_textdomain() call and its accompanying plugin_locale filter (not needed for WordPress.org-hosted plugins since WP 4.6).
* Settings are stored under a new option key (capysele_settings); existing installs will start from defaults after updating.

= 0.6.2 =
* Renamed the plugin again, from "Capybara SEO Lead Source Tracker for WhatsApp" to "Capybara SEO Lead Source Tracker" — WordPress.org's readme validator flagged "whatsapp" as a restricted term that cannot appear anywhere in the plugin name or permalink/slug (not just at the start). The word is still used freely in the description, FAQ, and tags, which aren't restricted. No functional changes; settings and stored data are preserved.

= 0.6.1 =
* Renamed the plugin from "WA Lead Source Tracker" to "Capybara SEO Lead Source Tracker for WhatsApp" — WordPress.org rejected the "WA" prefix as a restricted trademark-related term at the start of a plugin name/slug. No functional changes; settings and stored data are preserved.

= 0.6.0 =
* Added a floating WhatsApp button that the plugin can auto-inject on every page (bottom-right, standard chat-bubble style), with no need for an existing button, link, or shortcode placement.
* Replaced the old single, mutually-exclusive "operation mode" with independent, combinable toggles: Floating button and CSS Selector can now be turned on at the same time (e.g. keep tracking your existing button and also show the floating button on pages that don't have one). The shortcode is now always available regardless of these toggles. Existing sites are migrated automatically — no action needed.
* Reorganized the settings page into numbered sections (Enable & number, Where the button appears, Message, Advanced) with a plain-language guide explaining when to turn on each option.

= 0.5.8 =
* Added a settings link directly inside the plugin's description on the Plugins screen (in addition to the existing "Settings" row action).
* Plugin header Description is now sourced in English and translated to Spanish, consistent with the rest of the plugin's i18n strings.

= 0.5.7 =
* Fix: regional Spanish site locales (es_PE, es_MX, es_AR, es_CO, etc.) fell back to English because the bundled translation only matched es_ES exactly. Any es_* locale now maps to the bundled es_ES translation.
* Fully translated the default WhatsApp message template into Spanish (source/medium/campaign/term labels were previously left in English).
* Added a "Settings" quick link to the plugin's row on the Plugins screen.

= 0.5.6 =
* Fix: organic Google/Bing/Yahoo/DuckDuckGo/Baidu/Yandex/Ecosia search traffic without UTMs was misclassified as Referral instead of Organic. Search engine referrers are now detected and mapped to the Organic channel before the generic referral fallback.

= 0.5.5 =
* Added referral URL tracking via document.referrer: external referrers are captured and exposed via the {referrer} placeholder, and used as a fallback signal for Referral channel detection.

= 0.5.4 =
* Fix Joinchat integration: intercept click on document (capture phase) instead of updating data-settings DOM attribute, since Joinchat caches settings in memory on init.

= 0.5.3 =
* Joinchat plugin compatibility: selector targeting .joinchat updates message_send inside data-settings JSON.

= 0.5.2 =
* Replaced emoji with WhatsApp bold markdown (*[...]*) to avoid encoding corruption across all devices and WP sanitization pipeline.

= 0.5.1 =
* Replaced 📋 emoji with ⚠️ (better device support).

= 0.5.0 =
* Default message template now includes a framed reference block before tracking variables to discourage users from deleting attribution data.

= 0.4.0 =
* Added multilingual support: English and Spanish (auto-detected from WordPress site locale).
* English set as source language following WordPress i18n standards.
* Channel labels (Organic, Referral, etc.) are now translatable.

= 0.3.0 =
* Fixed channel detection: gclid, gbraid, wbraid now correctly identify Google Ads without requiring UTM parameters.
* Removed "Directo / sin dato" fallback — channel line is now hidden when there is no attribution data.
* Lines with no captured data are filtered from the WhatsApp message.
* Consecutive blank lines collapsed after filtering.

= 0.2.0 =
* Operation mode (CSS Selector vs Shortcode) now correctly controls which buttons are targeted.
* Shortcode mode targets only plugin-generated buttons.

= 0.1.0 =
* Initial MVP release.
