<?php
/**
 * Plugin Name: Capybara SEO Lead Source Tracker
 * Plugin URI: https://seo.pe
 * Description: Captures UTMs and click IDs, keeps them across page visits, and adds them to your WhatsApp messages via an auto-injected floating button, your existing buttons, and/or a shortcode — combinable. <a href="options-general.php?page=capysele-lead-source-tracker">Configure the plugin</a>.
 * Version: 0.9.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: Henry Silva
 * License: GPLv2 or later
 * Text Domain: capybara-seo-lead-source-tracker
 */

if (!defined('ABSPATH')) {
    exit;
}

define('CAPYSELE_VERSION', '0.9.0');
define('CAPYSELE_PLUGIN_FILE', __FILE__);
define('CAPYSELE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('CAPYSELE_PLUGIN_URL', plugin_dir_url(__FILE__));
define('CAPYSELE_OPTION_KEY', 'capysele_settings');

require_once CAPYSELE_PLUGIN_DIR . 'includes/class-capysele-settings.php';
require_once CAPYSELE_PLUGIN_DIR . 'includes/class-capysele-shortcode.php';
require_once CAPYSELE_PLUGIN_DIR . 'includes/class-capysele-plugin.php';

function capysele_activate() {
    $defaults = CAPYSELE_Settings::get_defaults();
    $existing = get_option(CAPYSELE_OPTION_KEY, []);
    if (!is_array($existing)) {
        $existing = [];
    }
    update_option(CAPYSELE_OPTION_KEY, wp_parse_args($existing, $defaults));
}
register_activation_hook(__FILE__, 'capysele_activate');

function capysele_boot_plugin() {
    $plugin = new CAPYSELE_Plugin();
    $plugin->init();
}
capysele_boot_plugin();
