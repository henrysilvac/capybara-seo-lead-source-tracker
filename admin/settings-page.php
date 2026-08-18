<?php
if (!defined('ABSPATH')) {
    exit;
}
?>
<div class="wrap capysele-wrap">
    <h1><?php echo esc_html('Capybara SEO Lead Source Tracker'); ?></h1>
    <p><?php esc_html_e('Captures UTM parameters and click IDs, keeps them across page visits (first-touch attribution), and automatically includes them in the WhatsApp message of your floating button, your existing buttons, and/or the [capysele_button] shortcode.', 'capybara-seo-lead-source-tracker'); ?></p>

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
        <code>{landing_page}</code>
        <code>{captured_at}</code>
    </div>
</div>
