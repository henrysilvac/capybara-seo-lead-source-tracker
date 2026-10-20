<?php
// Focused test for CAPYSELE_Settings with minimal WordPress stubs (no WP install needed).
// Run from the repository root: php tests/settings.test.php
define('ABSPATH', '/tmp/');
define('DAY_IN_SECONDS', 86400);
define('CAPYSELE_OPTION_KEY', 'capysele_settings');
$GLOBALS['opt'] = null;
function get_option($k, $d = false) { return $GLOBALS['opt'] === null ? $d : $GLOBALS['opt']; }
function wp_parse_args($a, $d) { return array_merge($d, (array) $a); }
function __($s) { return $s; }
function esc_html__($s) { return htmlspecialchars($s); }
function esc_html_e($s) { echo htmlspecialchars($s); }
function esc_html($s) { return htmlspecialchars($s); }
function esc_attr($s) { return htmlspecialchars($s, ENT_QUOTES); }
function esc_textarea($s) { return htmlspecialchars($s); }
function absint($n) { return abs((int) $n); }
function checked($a, $b = true) { if ((string) $a === (string) $b) echo ' checked="checked"'; }
function sanitize_text_field($s) { return trim($s); }
function wp_kses_post($s) { return $s; }
require dirname(__DIR__) . '/includes/class-capysele-settings.php';

$fail = 0;
function check($name, $cond) { global $fail; echo ($cond ? 'ok   ' : 'FAIL ') . $name . "\n"; if (!$cond) $fail++; }

// A01: defaults, legacy settings without key, invalid stored values.
check('defaults include last_click', CAPYSELE_Settings::get_defaults()['attribution_model'] === 'last_click');
$GLOBALS['opt'] = null;
check('fresh install → last_click', CAPYSELE_Settings::get_settings()['attribution_model'] === 'last_click');
$GLOBALS['opt'] = ['enabled' => 1, 'phone' => '51111', 'floating_enabled' => 0, 'selector_enabled' => 1, 'message_template' => 'T'];
$s = CAPYSELE_Settings::get_settings();
check('0.8.0 settings without key → last_click', $s['attribution_model'] === 'last_click');
check('0.8.0 settings otherwise unchanged (A17)', $s['phone'] === '51111' && $s['floating_enabled'] === 0 && $s['selector_enabled'] === 1 && $s['message_template'] === 'T');
foreach (['linear', 'FIRST_CLICK', ' first_click', '', 1, 0, null, true, ['first_click'], new stdClass()] as $bad) {
    $GLOBALS['opt'] = ['attribution_model' => $bad];
    check('stored invalid ' . json_encode($bad) . ' → last_click', CAPYSELE_Settings::get_settings()['attribution_model'] === 'last_click');
    check('sanitize invalid ' . json_encode($bad) . ' → last_click', CAPYSELE_Settings::sanitize_settings(['attribution_model' => $bad])['attribution_model'] === 'last_click');
}
$GLOBALS['opt'] = 'corrupt';
check('non-array option → last_click', CAPYSELE_Settings::get_settings()['attribution_model'] === 'last_click');

// A02: a valid first_click is kept on read and on saving the full form.
$GLOBALS['opt'] = ['attribution_model' => 'first_click'];
check('stored first_click kept', CAPYSELE_Settings::get_settings()['attribution_model'] === 'first_click');
$saved = CAPYSELE_Settings::sanitize_settings(['enabled' => '1', 'phone' => '+51 999', 'attribution_model' => 'first_click', 'message_template' => 'Hi']);
check('sanitize keeps first_click', $saved['attribution_model'] === 'first_click');
check('sanitize keeps other fields', $saved['phone'] === '51999' && $saved['message_template'] === 'Hi');
check('sanitize missing key → last_click', CAPYSELE_Settings::sanitize_settings([])['attribution_model'] === 'last_click');

// Legacy "mode" migration still works alongside the new key.
$GLOBALS['opt'] = ['mode' => 'selector'];
$s = CAPYSELE_Settings::get_settings();
check('legacy mode migration preserved', $s['selector_enabled'] === 1 && $s['floating_enabled'] === 0 && $s['attribution_model'] === 'last_click');

// Radios render with the saved value checked.
foreach (['first_click', 'last_click'] as $model) {
    $GLOBALS['opt'] = ['attribution_model' => $model];
    ob_start();
    CAPYSELE_Settings::render_field(['key' => 'attribution_model']);
    $html = ob_get_clean();
    check("render: two radios ($model)", substr_count($html, 'type="radio"') === 2);
    check("render: $model checked", (bool) preg_match('/value="' . $model . '"[^>]*checked="checked"/', $html));
    check("render: only one checked ($model)", substr_count($html, 'checked="checked"') === 1);
    check("render: fieldset + legend + help ($model)", strpos($html, '<fieldset') !== false && strpos($html, '<legend') !== false && strpos($html, 'id="capysele-attribution-model-help"') !== false);
}
exit($fail ? 1 : 0);
