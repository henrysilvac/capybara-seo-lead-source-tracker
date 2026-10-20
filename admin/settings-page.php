<?php
if (!defined('ABSPATH')) {
    exit;
}
?>
<div class="wrap capysele-wrap">
    <h1><?php echo esc_html('Capybara SEO Lead Source Tracker'); ?></h1>
    <p><?php esc_html_e('Captures UTM parameters and click IDs, keeps them across page visits with the attribution model you choose (last click by default, or first click), and automatically includes them in the WhatsApp message of your floating button, your existing buttons, and/or the [capysele_button] shortcode.', 'capybara-seo-lead-source-tracker'); ?></p>

    <form method="post" action="options.php">
        <?php
        settings_fields('capysele_settings_group');
        do_settings_sections('capysele-lead-source-tracker');
        submit_button(__('Save changes', 'capybara-seo-lead-source-tracker'));
        ?>
    </form>

    <hr />

    <h2><?php esc_html_e('Quick setup', 'capybara-seo-lead-source-tracker'); ?></h2>
    <ol>
        <li><?php esc_html_e('Set your WhatsApp number and save (section 1).', 'capybara-seo-lead-source-tracker'); ?></li>
        <li><?php esc_html_e('Turn on the button placement(s) that match your situation, following the guide in section 2.', 'capybara-seo-lead-source-tracker'); ?></li>
        <li><?php esc_html_e('Choose the attribution model in section 3: last click credits the most recent identifiable source before the WhatsApp click; first click keeps the first one captured. Save, then reload the site page before testing.', 'capybara-seo-lead-source-tracker'); ?></li>
        <li><?php esc_html_e('Test with a URL that includes UTM parameters, for example ?utm_source=google&utm_medium=cpc&utm_campaign=test', 'capybara-seo-lead-source-tracker'); ?></li>
    </ol>

    <h2><?php esc_html_e('Placeholder reference', 'capybara-seo-lead-source-tracker'); ?></h2>
    <div class="capysele-placeholders">
        <code>{channel}</code>
        <code>{utm_source}</code>
        <code>{utm_medium}</code>
        <code>{utm_campaign}</code>
        <code>{utm_content}</code>
        <code>{utm_term}</code>
        <code>{gclid}</code>
        <code>{gbraid}</code>
        <code>{wbraid}</code>
        <code>{fbclid}</code>
        <code>{referrer}</code>
        <code>{exit_page}</code>
        <code>{exit_page_title}</code>
        <code>{landing_page}</code>
        <code>{captured_at}</code>
    </div>
    <p class="description"><?php esc_html_e('Use {exit_page} for the complete URL where the visitor clicks. {landing_page} is a legacy alias that returns the same click-time URL and remains available for existing templates.', 'capybara-seo-lead-source-tracker'); ?></p>
    <p class="description"><?php esc_html_e('{captured_at} is the date of the selected capture: the initial one with first click, the most recent one with last click. If there is no valid capture, it shows the time of the WhatsApp click instead, which is not evidence of a real capture.', 'capybara-seo-lead-source-tracker'); ?></p>
    <p class="description"><?php esc_html_e('Use {exit_page_title} for the title of the page where the visitor clicks (the browser tab title), read at the moment of the click. Use the title, the URL, or both; if the page has no title, its line is removed from the message.', 'capybara-seo-lead-source-tracker'); ?></p>

    <h2><?php esc_html_e('How the channel is detected', 'capybara-seo-lead-source-tracker'); ?></h2>
    <p><?php esc_html_e('{channel} describes the source selected by the configured attribution model (the latest or the first identifiable entry), not necessarily the visit where they click. Rules are checked in this order:', 'capybara-seo-lead-source-tracker'); ?></p>
    <ol>
        <li><?php esc_html_e('Google Ads or Meta Ads: paid UTM parameters (e.g. utm_source=google&utm_medium=cpc) or a click ID (gclid, gbraid, wbraid, fbclid).', 'capybara-seo-lead-source-tracker'); ?></li>
        <li><?php esc_html_e('Organic: utm_medium=organic.', 'capybara-seo-lead-source-tracker'); ?></li>
        <li><?php esc_html_e('AI platforms (ChatGPT, Claude, Gemini, Copilot, Perplexity): detected from the referrer domain when there is no click ID and utm_medium is empty or "referral".', 'capybara-seo-lead-source-tracker'); ?></li>
        <li><?php esc_html_e('Referral: utm_medium=referral, or a visit from another website.', 'capybara-seo-lead-source-tracker'); ?></li>
        <li><?php esc_html_e('Organic: a visit from a search engine (Google, Bing, Yahoo, DuckDuckGo, Baidu, Yandex, Ecosia).', 'capybara-seo-lead-source-tracker'); ?></li>
    </ol>
    <p class="description"><?php esc_html_e('With no UTMs, click IDs or external referrer, no channel is assigned and the {channel} line is removed.', 'capybara-seo-lead-source-tracker'); ?></p>

    <h2><?php esc_html_e('How long attribution is kept', 'capybara-seo-lead-source-tracker'); ?></h2>
    <p><?php
    $capysele_days = CAPYSELE_Settings::get_attribution_days();
    echo esc_html(sprintf(
        /* translators: %d: number of days the attribution is kept. */
        _n(
            'Attribution is kept in this browser\'s local storage for %d day, counted from the selected capture. With last click, each new identifiable entry (UTMs, click IDs or an external referrer) replaces the whole record and restarts the period. With first click, later entries don\'t replace the source or restart the period. In both models, visits without source signals and WhatsApp clicks never renew it. Once it expires, the plugin stops using that record and deletes it the next time it runs; a new identifiable visit can then start a new attribution period.',
            'Attribution is kept in this browser\'s local storage for %d days, counted from the selected capture. With last click, each new identifiable entry (UTMs, click IDs or an external referrer) replaces the whole record and restarts the period. With first click, later entries don\'t replace the source or restart the period. In both models, visits without source signals and WhatsApp clicks never renew it. Once it expires, the plugin stops using that record and deletes it the next time it runs; a new identifiable visit can then start a new attribution period.',
            $capysele_days,
            'capybara-seo-lead-source-tracker'
        ),
        $capysele_days
    ));
    ?></p>
    <p class="description"><?php esc_html_e('Attribution is stored per browser and device; it does not identify the same visitor across devices.', 'capybara-seo-lead-source-tracker'); ?></p>
</div>
