<?php
if (!defined('ABSPATH')) {
    exit;
}

class RBW_Admin {

    public function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_filter('plugin_action_links_restaurant-booking-widget/restaurant-booking-widget.php', array($this, 'add_settings_link'));
        add_action('wp_ajax_rbw_test_resos_connection', array($this, 'ajax_test_resos_connection'));
        add_action('wp_ajax_rbw_load_resos_fields', array($this, 'ajax_load_resos_fields'));
    }

    public function add_settings_link($links) {
        $settings_link = '<a href="' . admin_url('options-general.php?page=restaurant-booking-widget') . '">Settings</a>';
        array_unshift($links, $settings_link);
        return $links;
    }

    public function add_admin_menu() {
        add_options_page(
            'Booking Widget Settings',
            'Booking Widget',
            'manage_options',
            'restaurant-booking-widget',
            array($this, 'render_settings_page')
        );
    }

    public function register_settings() {
        $settings = array(
            // API Credentials
            'rbw_resos_api_key'              => 'sanitize_text_field',
            'rbw_newbook_username'            => 'sanitize_text_field',
            'rbw_newbook_password'            => 'sanitize_text_field',
            'rbw_newbook_api_key'             => 'sanitize_text_field',
            'rbw_newbook_region'              => 'sanitize_text_field',
            // General
            'rbw_restaurant_phone'            => 'sanitize_text_field',
            'rbw_turnstile_site_key'          => 'sanitize_text_field',
            'rbw_turnstile_secret'            => 'sanitize_text_field',
            'rbw_default_closeout_message'    => 'sanitize_textarea_field',
            // Widget
            'rbw_max_party_size'              => 'absint',
            'rbw_max_booking_window'          => 'absint',
            'rbw_colour_preset'               => 'sanitize_text_field',
            // Custom Field Mapping
            'rbw_field_hotel_guest'           => 'sanitize_text_field',
            'rbw_field_booking_ref'           => 'sanitize_text_field',
            'rbw_field_hotel_guest_yes_choice' => 'sanitize_text_field',
        );

        foreach ($settings as $name => $sanitize) {
            register_setting('rbw_settings_group', $name, array(
                'type' => 'string',
                'sanitize_callback' => $sanitize,
                'default' => '',
            ));
        }
    }

    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        ?>
        <div class="wrap">
            <h1>Booking Widget Settings</h1>
            <form method="post" action="options.php">
                <?php
                settings_fields('rbw_settings_group');
                ?>

                <h2 class="title">API Credentials</h2>
                <table class="form-table">
                    <tr>
                        <th scope="row"><label for="rbw_resos_api_key">ResOS API Key</label></th>
                        <td>
                            <input type="text" id="rbw_resos_api_key" name="rbw_resos_api_key"
                                value="<?php echo esc_attr(get_option('rbw_resos_api_key')); ?>"
                                class="regular-text" />
                            <button type="button" class="button" id="rbw-test-resos">Test Connection</button>
                            <span id="rbw-test-resos-result"></span>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="rbw_newbook_username">NewBook Username</label></th>
                        <td><input type="text" id="rbw_newbook_username" name="rbw_newbook_username"
                            value="<?php echo esc_attr(get_option('rbw_newbook_username')); ?>"
                            class="regular-text" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="rbw_newbook_password">NewBook Password</label></th>
                        <td><input type="password" id="rbw_newbook_password" name="rbw_newbook_password"
                            value="<?php echo esc_attr(get_option('rbw_newbook_password')); ?>"
                            class="regular-text" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="rbw_newbook_api_key">NewBook API Key</label></th>
                        <td><input type="text" id="rbw_newbook_api_key" name="rbw_newbook_api_key"
                            value="<?php echo esc_attr(get_option('rbw_newbook_api_key')); ?>"
                            class="regular-text" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="rbw_newbook_region">NewBook Region</label></th>
                        <td><input type="text" id="rbw_newbook_region" name="rbw_newbook_region"
                            value="<?php echo esc_attr(get_option('rbw_newbook_region')); ?>"
                            class="regular-text" placeholder="e.g. au" /></td>
                    </tr>
                </table>

                <h2 class="title">General</h2>
                <table class="form-table">
                    <tr>
                        <th scope="row"><label for="rbw_restaurant_phone">Restaurant Phone</label></th>
                        <td><input type="text" id="rbw_restaurant_phone" name="rbw_restaurant_phone"
                            value="<?php echo esc_attr(get_option('rbw_restaurant_phone', '01451 830297')); ?>"
                            class="regular-text" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="rbw_turnstile_site_key">Turnstile Site Key</label></th>
                        <td><input type="text" id="rbw_turnstile_site_key" name="rbw_turnstile_site_key"
                            value="<?php echo esc_attr(get_option('rbw_turnstile_site_key')); ?>"
                            class="regular-text" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="rbw_turnstile_secret">Turnstile Secret Key</label></th>
                        <td><input type="password" id="rbw_turnstile_secret" name="rbw_turnstile_secret"
                            value="<?php echo esc_attr(get_option('rbw_turnstile_secret')); ?>"
                            class="regular-text" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="rbw_default_closeout_message">Default Closeout Message</label></th>
                        <td><textarea id="rbw_default_closeout_message" name="rbw_default_closeout_message"
                            class="large-text" rows="2"><?php echo esc_textarea(get_option('rbw_default_closeout_message', 'Fully booked. Please call us to enquire.')); ?></textarea>
                            <p class="description">Shown when a period is closed and has no %%message%% marker.</p>
                        </td>
                    </tr>
                </table>

                <h2 class="title">Widget</h2>
                <table class="form-table">
                    <tr>
                        <th scope="row"><label for="rbw_max_party_size">Max Party Size</label></th>
                        <td><input type="number" id="rbw_max_party_size" name="rbw_max_party_size"
                            value="<?php echo esc_attr(get_option('rbw_max_party_size', 12)); ?>"
                            min="2" max="50" class="small-text" />
                            <p class="description">Last button becomes [{max}+] with "please call" message.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="rbw_max_booking_window">Max Booking Window (days)</label></th>
                        <td><input type="number" id="rbw_max_booking_window" name="rbw_max_booking_window"
                            value="<?php echo esc_attr(get_option('rbw_max_booking_window', 180)); ?>"
                            min="7" max="365" class="small-text" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="rbw_colour_preset">Colour Preset</label></th>
                        <td>
                            <select id="rbw_colour_preset" name="rbw_colour_preset">
                                <?php $current = get_option('rbw_colour_preset', 'warm'); ?>
                                <option value="warm" <?php selected($current, 'warm'); ?>>Warm</option>
                                <option value="light" <?php selected($current, 'light'); ?>>Light</option>
                                <option value="dark" <?php selected($current, 'dark'); ?>>Dark</option>
                                <option value="cold" <?php selected($current, 'cold'); ?>>Cold</option>
                            </select>
                        </td>
                    </tr>
                </table>

                <h2 class="title">Custom Field Mapping</h2>
                <p>Map resOS custom fields used for hotel guest tagging. Other fields (dietary, etc.) are rendered dynamically from the booking flow.</p>
                <table class="form-table">
                    <tr>
                        <th scope="row">Load Fields</th>
                        <td>
                            <button type="button" class="button" id="rbw-load-fields">Load Fields from resOS</button>
                            <span id="rbw-load-fields-result"></span>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="rbw_field_hotel_guest">Hotel Guest Field</label></th>
                        <td>
                            <select id="rbw_field_hotel_guest" name="rbw_field_hotel_guest" class="rbw-field-select">
                                <option value="">-- Select --</option>
                                <?php if ($val = get_option('rbw_field_hotel_guest')): ?>
                                    <option value="<?php echo esc_attr($val); ?>" selected><?php echo esc_html($val); ?> (saved)</option>
                                <?php endif; ?>
                            </select>
                            <p class="description">Radio/dropdown field. Auto-detects fields containing "Hotel" and "Guest".</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="rbw_field_booking_ref">Booking # Field</label></th>
                        <td>
                            <select id="rbw_field_booking_ref" name="rbw_field_booking_ref" class="rbw-field-select">
                                <option value="">-- Select --</option>
                                <?php if ($val = get_option('rbw_field_booking_ref')): ?>
                                    <option value="<?php echo esc_attr($val); ?>" selected><?php echo esc_html($val); ?> (saved)</option>
                                <?php endif; ?>
                            </select>
                            <p class="description">Text field. Auto-detects fields containing "Booking" and "#".</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Hotel Guest "Yes" Choice ID</th>
                        <td>
                            <input type="text" id="rbw_field_hotel_guest_yes_choice" name="rbw_field_hotel_guest_yes_choice"
                                value="<?php echo esc_attr(get_option('rbw_field_hotel_guest_yes_choice')); ?>"
                                class="regular-text" readonly />
                            <p class="description">Auto-resolved when fields are loaded. The choice ID for "Yes" on the Hotel Guest field.</p>
                        </td>
                    </tr>
                </table>

                <?php submit_button(); ?>
            </form>
        </div>

        <script>
        jQuery(function($) {
            $('#rbw-test-resos').on('click', function() {
                var btn = $(this);
                var result = $('#rbw-test-resos-result');
                btn.prop('disabled', true);
                result.text('Testing...');
                $.post(ajaxurl, {
                    action: 'rbw_test_resos_connection',
                    api_key: $('#rbw_resos_api_key').val(),
                    _wpnonce: '<?php echo wp_create_nonce('rbw_admin_ajax'); ?>'
                }, function(response) {
                    btn.prop('disabled', false);
                    result.text(response.data.message).css('color', response.success ? 'green' : 'red');
                }).fail(function() {
                    btn.prop('disabled', false);
                    result.text('Request failed').css('color', 'red');
                });
            });

            $('#rbw-load-fields').on('click', function() {
                var btn = $(this);
                var result = $('#rbw-load-fields-result');
                btn.prop('disabled', true);
                result.text('Loading...');
                $.post(ajaxurl, {
                    action: 'rbw_load_resos_fields',
                    api_key: $('#rbw_resos_api_key').val(),
                    _wpnonce: '<?php echo wp_create_nonce('rbw_admin_ajax'); ?>'
                }, function(response) {
                    btn.prop('disabled', false);
                    if (!response.success) {
                        result.text(response.data.message).css('color', 'red');
                        return;
                    }
                    result.text('Loaded ' + response.data.fields.length + ' fields').css('color', 'green');

                    var fields = response.data.fields;
                    var hotelGuestSelect = $('#rbw_field_hotel_guest');
                    var bookingRefSelect = $('#rbw_field_booking_ref');
                    var savedHotelGuest = hotelGuestSelect.val();
                    var savedBookingRef = bookingRefSelect.val();

                    hotelGuestSelect.empty().append('<option value="">-- Select --</option>');
                    bookingRefSelect.empty().append('<option value="">-- Select --</option>');

                    var autoHotelGuest = '';
                    var autoBookingRef = '';
                    var yesChoiceId = '';

                    fields.forEach(function(field) {
                        var label = field.name.trim() + ' (' + field.type + ')';
                        var opt = '<option value="' + field._id + '">' + label + '</option>';
                        hotelGuestSelect.append(opt);
                        bookingRefSelect.append(opt);

                        var nameLower = field.name.trim().toLowerCase();
                        if (nameLower.indexOf('hotel') !== -1 && nameLower.indexOf('guest') !== -1) {
                            autoHotelGuest = field._id;
                            if (field.multipleChoiceSelections) {
                                field.multipleChoiceSelections.forEach(function(choice) {
                                    if (choice.name.toLowerCase() === 'yes') {
                                        yesChoiceId = choice._id;
                                    }
                                });
                            }
                        }
                        if (nameLower.indexOf('booking') !== -1 && nameLower.indexOf('#') !== -1) {
                            autoBookingRef = field._id;
                        }
                    });

                    hotelGuestSelect.val(savedHotelGuest || autoHotelGuest);
                    bookingRefSelect.val(savedBookingRef || autoBookingRef);
                    if (yesChoiceId) {
                        $('#rbw_field_hotel_guest_yes_choice').val(yesChoiceId);
                    }
                }).fail(function() {
                    btn.prop('disabled', false);
                    result.text('Request failed').css('color', 'red');
                });
            });
        });
        </script>
        <?php
    }

    public function ajax_test_resos_connection() {
        check_ajax_referer('rbw_admin_ajax');
        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => 'Unauthorized'));
        }

        $api_key = sanitize_text_field($_POST['api_key'] ?? '');
        if (empty($api_key)) {
            wp_send_json_error(array('message' => 'API key is empty'));
        }

        $response = wp_remote_get('https://api.resos.com/v1/openingHours?showDeleted=false', array(
            'timeout' => 15,
            'headers' => array(
                'Authorization' => 'Basic ' . base64_encode($api_key . ':'),
                'Content-Type' => 'application/json',
            ),
        ));

        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => 'Connection failed: ' . $response->get_error_message()));
        }

        $code = wp_remote_retrieve_response_code($response);
        if ($code === 200) {
            wp_send_json_success(array('message' => 'Connected successfully'));
        } elseif ($code === 401) {
            wp_send_json_error(array('message' => 'Invalid API key (401)'));
        } else {
            wp_send_json_error(array('message' => 'API returned status ' . $code));
        }
    }

    public function ajax_load_resos_fields() {
        check_ajax_referer('rbw_admin_ajax');
        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => 'Unauthorized'));
        }

        $api_key = sanitize_text_field($_POST['api_key'] ?? '');
        if (empty($api_key)) {
            wp_send_json_error(array('message' => 'API key is empty'));
        }

        $response = wp_remote_get('https://api.resos.com/v1/customFields', array(
            'timeout' => 15,
            'headers' => array(
                'Authorization' => 'Basic ' . base64_encode($api_key . ':'),
                'Content-Type' => 'application/json',
            ),
        ));

        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => 'Failed: ' . $response->get_error_message()));
        }

        $code = wp_remote_retrieve_response_code($response);
        if ($code !== 200) {
            wp_send_json_error(array('message' => 'API returned status ' . $code));
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        if (!is_array($body)) {
            wp_send_json_error(array('message' => 'Invalid response'));
        }

        wp_send_json_success(array('fields' => $body));
    }
}
