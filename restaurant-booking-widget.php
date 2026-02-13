<?php
/**
 * Plugin Name: Restaurant Booking Widget
 * Plugin URI: https://hotelnumberfour.com
 * Description: Custom restaurant booking widget with resOS integration, progressive reveal flow, and hotel resident support.
 * Version: 1.0.0
 * Author: Number Four
 * License: GPL v2 or later
 * Text Domain: restaurant-booking-widget
 * Requires at least: 5.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('RBW_VERSION', '1.0.0');
define('RBW_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('RBW_PLUGIN_URL', plugin_dir_url(__FILE__));

class Restaurant_Booking_Widget {

    private static $instance = null;

    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->load_dependencies();

        add_action('rest_api_init', array($this, 'register_routes'));
        add_action('init', array($this, 'register_shortcode'));
        add_action('wp_enqueue_scripts', array($this, 'maybe_enqueue_assets'));
    }

    private function load_dependencies() {
        require_once RBW_PLUGIN_DIR . 'includes/class-rbw-resos-client.php';
        require_once RBW_PLUGIN_DIR . 'includes/class-rbw-closeout-parser.php';
        require_once RBW_PLUGIN_DIR . 'includes/class-rbw-duplicate-checker.php';
        require_once RBW_PLUGIN_DIR . 'includes/class-rbw-rate-limiter.php';
        require_once RBW_PLUGIN_DIR . 'includes/class-rbw-rest-controller.php';

        if (is_admin()) {
            require_once RBW_PLUGIN_DIR . 'includes/class-rbw-admin.php';
            new RBW_Admin();
        }
    }

    public function register_routes() {
        $controller = new RBW_REST_Controller();
        $controller->register_routes();
    }

    public function register_shortcode() {
        add_shortcode('restaurant_booking', array($this, 'render_shortcode'));
    }

    public function render_shortcode($atts) {
        $this->enqueue_assets();
        return '<div id="rbw-widget"></div>';
    }

    public function maybe_enqueue_assets() {
        global $post;
        if ($post && has_shortcode($post->post_content, 'restaurant_booking')) {
            $this->enqueue_assets();
        }
    }

    private $assets_enqueued = false;

    private function enqueue_assets() {
        if ($this->assets_enqueued) {
            return;
        }
        $this->assets_enqueued = true;

        $dist_dir = RBW_PLUGIN_DIR . 'frontend/dist/assets/';
        $dist_url = RBW_PLUGIN_URL . 'frontend/dist/assets/';

        if (!is_dir($dist_dir)) {
            return;
        }

        // Find the built JS and CSS files
        $js_file = null;
        $css_file = null;
        $files = scandir($dist_dir);
        foreach ($files as $file) {
            if (preg_match('/\.js$/', $file) && !preg_match('/\.map$/', $file)) {
                $js_file = $file;
            }
            if (preg_match('/\.css$/', $file)) {
                $css_file = $file;
            }
        }

        if ($css_file) {
            wp_enqueue_style(
                'rbw-widget',
                $dist_url . $css_file,
                array(),
                RBW_VERSION
            );
        }

        if ($js_file) {
            wp_enqueue_script(
                'rbw-widget',
                $dist_url . $js_file,
                array(),
                RBW_VERSION,
                true
            );

            wp_localize_script('rbw-widget', 'rbwConfig', array(
                'restUrl' => esc_url_raw(rest_url('rbw/v1/')),
                'nonce' => wp_create_nonce('wp_rest'),
                'phone' => get_option('rbw_restaurant_phone', '01451 830297'),
                'turnstileSiteKey' => get_option('rbw_turnstile_site_key', ''),
                'maxPartySize' => intval(get_option('rbw_max_party_size', 12)),
                'maxBookingWindow' => intval(get_option('rbw_max_booking_window', 180)),
                'colourPreset' => get_option('rbw_colour_preset', 'warm'),
                'mappedFieldIds' => array(
                    'hotelGuest' => get_option('rbw_field_hotel_guest', ''),
                    'bookingRef' => get_option('rbw_field_booking_ref', ''),
                ),
            ));
        }
    }
}

// Initialize plugin
add_action('plugins_loaded', function() {
    Restaurant_Booking_Widget::get_instance();
});
