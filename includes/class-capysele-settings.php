<?php
if (!defined('ABSPATH')) {
    exit;
}

class CAPYSELE_Settings {
    // Attribution is kept in the visitor's browser for this many days, counted
    // from the selected capture: the first one (first click) or the latest
    // identifiable one (last click). Visits without signals never renew it.
    const DEFAULT_ATTRIBUTION_DAYS = 7;

    const ATTRIBUTION_MODELS = ['last_click', 'first_click'];
    const DEFAULT_ATTRIBUTION_MODEL = 'last_click';

    public static function get_attribution_days() {
        $days = absint(self::DEFAULT_ATTRIBUTION_DAYS);
        return $days > 0 ? $days : 7;
    }

    public static function get_attribution_ttl_ms() {
        return self::get_attribution_days() * DAY_IN_SECONDS * 1000;
    }

    // Only the exact strings in ATTRIBUTION_MODELS are accepted; anything else
    // (missing, arrays, numbers, unknown values) resolves to last click.
    public static function normalize_attribution_model($value) {
        return (is_string($value) && in_array($value, self::ATTRIBUTION_MODELS, true))
            ? $value
            : self::DEFAULT_ATTRIBUTION_MODEL;
    }

    public static function get_defaults() {
        return [
            'enabled' => 1,
            'phone' => '51999999999',
            'attribution_model' => self::DEFAULT_ATTRIBUTION_MODEL,
            'message_template' => __("Hi, I'd like more information.\n\n*[Do not modify — reference code to assign you the right advisor]:*\n[channel:{channel}]\n[source:{utm_source}]\n[medium:{utm_medium}]\n[campaign:{utm_campaign}]\n[term:{utm_term}]\n[gclid:{gclid}]", 'capybara-seo-lead-source-tracker'),
            'floating_enabled' => 1,
            'selector_enabled' => 0,
            'selector' => '.js-whatsapp-track',
            'debug' => 0,
        ];
    }

    public static function get_settings() {
        $saved = get_option(CAPYSELE_OPTION_KEY, []);
        if (!is_array($saved)) {
            $saved = [];
        }
        $settings = wp_parse_args($saved, self::get_defaults());

        // Migrate the pre-0.7.0 single "mode" option (selector|shortcode|floating)
        // into independent, combinable toggles the first time it's read.
        if (isset($saved['mode']) && !isset($saved['floating_enabled']) && !isset($saved['selector_enabled'])) {
            $settings['floating_enabled'] = ($saved['mode'] === 'floating') ? 1 : 0;
            $settings['selector_enabled'] = ($saved['mode'] === 'selector') ? 1 : 0;
        }

        // Settings saved before 0.9.0 have no model and resolve to last click.
        $settings['attribution_model'] = self::normalize_attribution_model($settings['attribution_model']);

        return $settings;
    }

    public static function register_settings() {
        register_setting(
            'capysele_settings_group',
            CAPYSELE_OPTION_KEY,
            [
                'type' => 'array',
                'sanitize_callback' => [__CLASS__, 'sanitize_settings'],
                'default' => self::get_defaults(),
            ]
        );

        $sections = [
            'capysele_section_general' => [
                'title'    => __('1. Enable & WhatsApp number', 'capybara-seo-lead-source-tracker'),
                'callback' => [__CLASS__, 'render_general_section_intro'],
                'fields'   => [
                    'enabled' => __('Enable plugin', 'capybara-seo-lead-source-tracker'),
                    'phone'   => __('WhatsApp number', 'capybara-seo-lead-source-tracker'),
                ],
            ],
            'capysele_section_mode' => [
                'title'    => __('2. Where should the WhatsApp button appear?', 'capybara-seo-lead-source-tracker'),
                'callback' => [__CLASS__, 'render_mode_section_intro'],
                'fields'   => [
                    'floating_enabled' => __('Floating button', 'capybara-seo-lead-source-tracker'),
                    'selector_enabled' => __('CSS Selector', 'capybara-seo-lead-source-tracker'),
                    'selector'         => __('CSS selector value', 'capybara-seo-lead-source-tracker'),
                ],
            ],
            'capysele_section_message' => [
                'title'    => __('3. Message & attribution data', 'capybara-seo-lead-source-tracker'),
                'callback' => [__CLASS__, 'render_message_section_intro'],
                'fields'   => [
                    'attribution_model' => __('Attribution model', 'capybara-seo-lead-source-tracker'),
                    'message_template'  => __('Message template', 'capybara-seo-lead-source-tracker'),
                ],
            ],
            'capysele_section_advanced' => [
                'title'    => __('4. Advanced', 'capybara-seo-lead-source-tracker'),
                'callback' => [__CLASS__, 'render_advanced_section_intro'],
                'fields'   => [
                    'debug' => __('Debug mode', 'capybara-seo-lead-source-tracker'),
                ],
            ],
        ];

        foreach ($sections as $section_id => $section) {
            add_settings_section(
                $section_id,
                $section['title'],
                $section['callback'],
                'capysele-lead-source-tracker'
            );

            foreach ($section['fields'] as $key => $label) {
                add_settings_field(
                    'capysele_' . $key,
                    $label,
                    [__CLASS__, 'render_field'],
                    'capysele-lead-source-tracker',
                    $section_id,
                    ['key' => $key]
                );
            }
        }
    }

    public static function render_general_section_intro() {
        echo '<p class="description">' . esc_html__('Turn the plugin on and set the WhatsApp number that receives messages when no button-specific number is defined.', 'capybara-seo-lead-source-tracker') . '</p>';
    }

    public static function render_mode_section_intro() {
        ?>
        <p class="description"><?php esc_html_e('These options are independent — turn on any combination that matches your situation. All of them share the same WhatsApp number and message template above.', 'capybara-seo-lead-source-tracker'); ?></p>
        <ul class="capysele-mode-guide">
            <li>
                <strong><?php esc_html_e('Floating button — turn this on if you don\'t have a WhatsApp button yet.', 'capybara-seo-lead-source-tracker'); ?></strong>
                <?php esc_html_e('Automatically adds a ready-made button to every page. Zero setup. If you also have an existing WhatsApp button elsewhere (theme, page builder, another plugin) that isn\'t tracked via CSS Selector below, turning this on too will show two buttons.', 'capybara-seo-lead-source-tracker'); ?>
            </li>
            <li>
                <strong><?php esc_html_e('CSS Selector — turn this on if you already have a working WhatsApp button or link.', 'capybara-seo-lead-source-tracker'); ?></strong>
                <?php esc_html_e('Adds tracking to your existing button (from your theme, a page builder, or another plugin such as Joinchat) instead of replacing it. Requires the CSS selector that matches your button below. Can be combined with the floating button — for example, keep your existing button tracked and add the floating button on pages that don\'t have one.', 'capybara-seo-lead-source-tracker'); ?>
            </li>
            <li>
                <strong><?php esc_html_e('Shortcode — always available, no toggle needed.', 'capybara-seo-lead-source-tracker'); ?></strong>
                <?php esc_html_e('Insert [capysele_button] in any page, post, or widget to render a plugin-generated button exactly where you want it. Works independently of the two toggles above.', 'capybara-seo-lead-source-tracker'); ?>
            </li>
        </ul>
        <?php
    }

    public static function render_message_section_intro() {
        echo '<p class="description">' . esc_html__('This is the message pre-filled in WhatsApp when a visitor clicks the button. Placeholders are replaced with the captured data; a line is removed automatically if its placeholder has no data (e.g. no {gclid} on a visit with no Google Ads click ID).', 'capybara-seo-lead-source-tracker') . '</p>';
    }

    public static function render_advanced_section_intro() {
        echo '<p class="description">' . esc_html__('Settings for troubleshooting. Keep debug mode off in production; turn it on temporarily to confirm the plugin is capturing UTMs correctly.', 'capybara-seo-lead-source-tracker') . '</p>';
    }

    public static function sanitize_settings($input) {
        $defaults = self::get_defaults();
        $output = [];

        $output['enabled'] = !empty($input['enabled']) ? 1 : 0;
        $output['debug'] = !empty($input['debug']) ? 1 : 0;
        $output['phone'] = isset($input['phone']) ? preg_replace('/\D+/', '', (string) $input['phone']) : $defaults['phone'];

        $output['floating_enabled'] = !empty($input['floating_enabled']) ? 1 : 0;
        $output['selector_enabled'] = !empty($input['selector_enabled']) ? 1 : 0;

        $output['selector'] = isset($input['selector']) ? sanitize_text_field((string) $input['selector']) : $defaults['selector'];

        $output['attribution_model'] = self::normalize_attribution_model(isset($input['attribution_model']) ? $input['attribution_model'] : null);

        if (isset($input['message_template'])) {
            $message = wp_kses_post((string) $input['message_template']);
            $output['message_template'] = trim($message) !== '' ? $message : $defaults['message_template'];
        } else {
            $output['message_template'] = $defaults['message_template'];
        }

        return wp_parse_args($output, $defaults);
    }

    public static function render_field($args) {
        $settings = self::get_settings();
        $key = isset($args['key']) ? $args['key'] : '';

        switch ($key) {
            case 'enabled':
            case 'debug':
            case 'floating_enabled':
            case 'selector_enabled':
                $checkbox_labels = [
                    'enabled'          => __('Enable frontend functionality. Turn off to fully disable the button and tracking without deactivating the plugin.', 'capybara-seo-lead-source-tracker'),
                    'debug'            => __('Show captured data, its capture and expiry dates, and why the channel was assigned in the browser console (for troubleshooting only).', 'capybara-seo-lead-source-tracker'),
                    'floating_enabled' => __('Automatically add the floating WhatsApp button to every page.', 'capybara-seo-lead-source-tracker'),
                    'selector_enabled' => __('Add tracking to existing WhatsApp buttons/links matched by the CSS selector below.', 'capybara-seo-lead-source-tracker'),
                ];
                ?>
                <label>
                    <input type="checkbox" name="<?php echo esc_attr(CAPYSELE_OPTION_KEY); ?>[<?php echo esc_attr($key); ?>]" value="1" <?php checked(!empty($settings[$key])); ?> />
                    <?php echo esc_html($checkbox_labels[$key]); ?>
                </label>
                <?php
                break;

            case 'phone':
                ?>
                <input type="text" class="regular-text" name="<?php echo esc_attr(CAPYSELE_OPTION_KEY); ?>[phone]" value="<?php echo esc_attr($settings['phone']); ?>" placeholder="51999999999" />
                <p class="description"><?php esc_html_e('International format, digits only (country code + number, no + no spaces).', 'capybara-seo-lead-source-tracker'); ?></p>
                <?php
                break;

            case 'selector':
                ?>
                <input type="text" class="regular-text" name="<?php echo esc_attr(CAPYSELE_OPTION_KEY); ?>[selector]" value="<?php echo esc_attr($settings['selector']); ?>" placeholder=".js-whatsapp-track" />
                <p class="description"><?php esc_html_e('Only used when "CSS Selector" above is enabled — ignored otherwise. Example: .js-whatsapp-track or a[href*="wa.me"]', 'capybara-seo-lead-source-tracker'); ?></p>
                <?php
                break;

            case 'attribution_model':
                $models = [
                    'last_click'  => [
                        'label'       => __('Last click (default)', 'capybara-seo-lead-source-tracker'),
                        'description' => __('Attributes the contact to the most recent identifiable source before the WhatsApp click. Each new entry with UTMs, ad click IDs or an external referrer replaces the previous one and is kept for 7 days from that capture. Use it to know which source preceded the contact.', 'capybara-seo-lead-source-tracker'),
                    ],
                    'first_click' => [
                        'label'       => __('First click', 'capybara-seo-lead-source-tracker'),
                        'description' => __('Attributes the contact to the first identifiable source captured. It is kept for 7 days from that capture, even if other campaigns arrive later. Use it to know the initial source within that period.', 'capybara-seo-lead-source-tracker'),
                    ],
                ];
                ?>
                <fieldset class="capysele-model-options" aria-describedby="capysele-attribution-model-help">
                    <legend class="screen-reader-text"><?php esc_html_e('Attribution model', 'capybara-seo-lead-source-tracker'); ?></legend>
                    <?php foreach ($models as $value => $model) : ?>
                        <label class="capysele-model-option">
                            <input type="radio" name="<?php echo esc_attr(CAPYSELE_OPTION_KEY); ?>[attribution_model]" value="<?php echo esc_attr($value); ?>" aria-describedby="capysele-model-<?php echo esc_attr($value); ?>" <?php checked($settings['attribution_model'], $value); ?> />
                            <strong><?php echo esc_html($model['label']); ?></strong>
                            <span id="capysele-model-<?php echo esc_attr($value); ?>" class="description"><?php echo esc_html($model['description']); ?></span>
                        </label>
                    <?php endforeach; ?>
                </fieldset>
                <div id="capysele-attribution-model-help">
                    <p class="description"><?php esc_html_e('Example: a person arrives from Google Ads on Monday, comes back from ChatGPT on Wednesday and clicks WhatsApp on Thursday. Last click shows ChatGPT; first click shows Google Ads. Browsing between pages or coming back without source signals does not erase a valid attribution.', 'capybara-seo-lead-source-tracker'); ?></p>
                    <p class="description"><?php esc_html_e('Data is stored per browser and device. Switching models does not recover earlier visits that were not stored. To test a change, save the settings and reload the site page.', 'capybara-seo-lead-source-tracker'); ?></p>
                </div>
                <?php
                break;

            case 'message_template':
                ?>
                <textarea name="<?php echo esc_attr(CAPYSELE_OPTION_KEY); ?>[message_template]" rows="8" class="large-text code"><?php echo esc_textarea($settings['message_template']); ?></textarea>
                <p class="description"><?php esc_html_e('Available placeholders: {channel}, {utm_source}, {utm_medium}, {utm_campaign}, {utm_content}, {utm_term}, {gclid}, {gbraid}, {wbraid}, {fbclid}, {referrer}, {exit_page}, {exit_page_title}, {landing_page} (legacy alias of {exit_page}), {captured_at}', 'capybara-seo-lead-source-tracker'); ?></p>
                <?php
                break;
        }
    }
}
