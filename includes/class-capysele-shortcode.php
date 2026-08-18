<?php
if (!defined('ABSPATH')) {
    exit;
}

class CAPYSELE_Shortcode {
    public static function render($atts = []) {
        $settings = CAPYSELE_Settings::get_settings();

        $atts = shortcode_atts([
            'label' => __('Write to us on WhatsApp', 'capybara-seo-lead-source-tracker'),
            'phone' => $settings['phone'],
            'class' => 'js-whatsapp-track capysele-button',
        ], $atts, 'capysele_button');

        $classes = trim((string) $atts['class']);
        if ($classes === '') {
            $classes = 'js-whatsapp-track capysele-button';
        }

        $phone = preg_replace('/\D+/', '', (string) $atts['phone']);
        $fallback_href = 'https://wa.me/' . $phone;

        return sprintf(
            '<a href="%1$s" class="%2$s" data-capysele-phone="%3$s">%4$s</a>',
            esc_url($fallback_href),
            esc_attr($classes),
            esc_attr($phone),
            esc_html($atts['label'])
        );
    }
}
