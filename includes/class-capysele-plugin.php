<?php
if (!defined('ABSPATH')) {
    exit;
}

class CAPYSELE_Plugin {
    public function init() {
        add_action('admin_menu', [$this, 'register_admin_menu']);
        add_action('admin_init', ['CAPYSELE_Settings', 'register_settings']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_assets']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_public_assets']);
        add_action('wp_footer', [$this, 'render_floating_button']);
        add_action('admin_notices', [$this, 'render_admin_notice']);
        add_shortcode('capysele_button', ['CAPYSELE_Shortcode', 'render']);

        $plugin_basename = plugin_basename(CAPYSELE_PLUGIN_FILE);
        add_filter('plugin_action_links_' . $plugin_basename, [$this, 'add_settings_link']);
    }

    public function add_settings_link($links) {
        $settings_link = sprintf(
            '<a href="%1$s">%2$s</a>',
            esc_url(admin_url('options-general.php?page=capysele-lead-source-tracker')),
            esc_html__('Settings', 'capybara-seo-lead-source-tracker')
        );
        array_unshift($links, $settings_link);
        return $links;
    }

    public function register_admin_menu() {
        add_options_page(
            'Capybara SEO Lead Source Tracker',
            'Capybara SEO Lead Source Tracker',
            'manage_options',
            'capysele-lead-source-tracker',
            [$this, 'render_settings_page']
        );
    }

    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        $settings = CAPYSELE_Settings::get_settings();
        include CAPYSELE_PLUGIN_DIR . 'admin/settings-page.php';
    }

    public function enqueue_admin_assets($hook) {
        if ($hook !== 'settings_page_capysele-lead-source-tracker') {
            return;
        }

        wp_enqueue_style(
            'capysele-admin',
            CAPYSELE_PLUGIN_URL . 'admin/admin.css',
            [],
            CAPYSELE_VERSION
        );

        wp_enqueue_script(
            'capysele-admin',
            CAPYSELE_PLUGIN_URL . 'admin/admin.js',
            [],
            CAPYSELE_VERSION,
            true
        );
    }

    public function enqueue_public_assets() {
        $settings = CAPYSELE_Settings::get_settings();
        if (empty($settings['enabled'])) {
            return;
        }

        wp_enqueue_style(
            'capysele-public',
            CAPYSELE_PLUGIN_URL . 'public/public.css',
            [],
            CAPYSELE_VERSION
        );

        wp_enqueue_script(
            'capysele-public',
            CAPYSELE_PLUGIN_URL . 'public/public.js',
            [],
            CAPYSELE_VERSION,
            true
        );

        wp_localize_script('capysele-public', 'capysele_config', [
            'phone' => isset($settings['phone']) ? (string) $settings['phone'] : '',
            'template' => isset($settings['message_template']) ? (string) $settings['message_template'] : '',
            'selector' => isset($settings['selector']) ? (string) $settings['selector'] : '.js-whatsapp-track',
            'floatingEnabled' => !empty($settings['floating_enabled']),
            'selectorEnabled' => !empty($settings['selector_enabled']),
            'debug' => !empty($settings['debug']),
            'storageKey' => 'capysele_data',
            'siteUrl' => home_url('/'),
            'fallbackLabel' => __('N/A', 'capybara-seo-lead-source-tracker'),
            'channels' => [
                'google_ads' => __('Google Ads', 'capybara-seo-lead-source-tracker'),
                'meta_ads'   => __('Meta Ads', 'capybara-seo-lead-source-tracker'),
                'organic'    => __('Organic', 'capybara-seo-lead-source-tracker'),
                'referral'   => __('Referral', 'capybara-seo-lead-source-tracker'),
            ],
        ]);
    }

    public function render_floating_button() {
        $settings = CAPYSELE_Settings::get_settings();

        if (empty($settings['enabled']) || empty($settings['floating_enabled'])) {
            return;
        }

        $phone = isset($settings['phone']) ? preg_replace('/\D+/', '', (string) $settings['phone']) : '';
        if (!$phone) {
            return;
        }

        $label = __('Chat on WhatsApp', 'capybara-seo-lead-source-tracker');

        printf(
            '<a href="%1$s" class="capysele-floating-button" data-capysele-phone="%2$s" aria-label="%3$s" title="%3$s"><svg viewBox="0 0 24 24" width="28" height="28" fill="#fff" aria-hidden="true" focusable="false"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12.001 2c-5.523 0-9.999 4.476-9.999 9.999 0 1.764.464 3.49 1.346 5.006L2 22l5.107-1.34a9.96 9.96 0 004.894 1.24h.005c5.523 0 9.999-4.476 9.999-9.999S17.524 2 12.001 2zm0 18.164a8.13 8.13 0 01-4.138-1.132l-.297-.176-3.03.795.81-2.955-.193-.303a8.11 8.11 0 01-1.253-4.394c0-4.482 3.648-8.13 8.131-8.13 4.482 0 8.13 3.648 8.13 8.13 0 4.483-3.648 8.165-8.16 8.165z"/></svg></a>',
            esc_url('https://wa.me/' . $phone),
            esc_attr($phone),
            esc_attr($label)
        );
    }

    public function render_admin_notice() {
        if (!current_user_can('manage_options')) {
            return;
        }

        $screen = get_current_screen();
        if (!$screen || $screen->id !== 'settings_page_capysele-lead-source-tracker') {
            return;
        }

        echo '<div class="notice notice-info"><p>';
        echo esc_html__('Set up how the WhatsApp button appears below: turn on the floating button for a zero-setup button, add tracking to a button you already have with CSS Selector, or insert the [capysele_button] shortcode anywhere. These can be combined.', 'capybara-seo-lead-source-tracker');
        echo '</p></div>';
    }
}
