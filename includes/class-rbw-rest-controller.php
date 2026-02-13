<?php
if (!defined('ABSPATH')) {
    exit;
}

class RBW_REST_Controller extends WP_REST_Controller {

    protected $namespace = 'rbw/v1';

    public function register_routes() {
        register_rest_route($this->namespace, '/opening-hours', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array($this, 'get_opening_hours'),
            'permission_callback' => '__return_true',
            'args'                => array(
                'date' => array(
                    'required'          => true,
                    'sanitize_callback' => 'sanitize_text_field',
                    'validate_callback' => array($this, 'validate_date'),
                ),
            ),
        ));

        register_rest_route($this->namespace, '/available-times', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'get_available_times'),
            'permission_callback' => '__return_true',
            'args'                => array(
                'date' => array(
                    'required'          => true,
                    'sanitize_callback' => 'sanitize_text_field',
                    'validate_callback' => array($this, 'validate_date'),
                ),
                'people' => array(
                    'required'          => true,
                    'sanitize_callback' => 'absint',
                ),
                'opening_hour_id' => array(
                    'required'          => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ),
            ),
        ));

        register_rest_route($this->namespace, '/create-booking', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'create_booking'),
            'permission_callback' => '__return_true',
            'args'                => array(
                'date'            => array('required' => true, 'sanitize_callback' => 'sanitize_text_field'),
                'time'            => array('required' => true, 'sanitize_callback' => 'sanitize_text_field'),
                'people'          => array('required' => true, 'sanitize_callback' => 'absint'),
                'name'            => array('required' => true, 'sanitize_callback' => 'sanitize_text_field'),
                'email'           => array('required' => true, 'sanitize_callback' => 'sanitize_email'),
                'phone'           => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                'notes'           => array('required' => false, 'sanitize_callback' => 'sanitize_textarea_field'),
                'custom_fields'   => array('required' => false),
                'turnstile_token' => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                'force_duplicate' => array('required' => false, 'sanitize_callback' => 'rest_sanitize_boolean'),
            ),
        ));
    }

    public function validate_date($param) {
        return (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $param);
    }

    /**
     * GET /rbw/v1/opening-hours?date=YYYY-MM-DD
     */
    public function get_opening_hours($request) {
        $ip = RBW_Rate_Limiter::get_client_ip();
        if (!RBW_Rate_Limiter::check($ip, 'read')) {
            return new WP_REST_Response(array('error' => 'Rate limit exceeded'), 429);
        }

        $date = $request->get_param('date');
        $client = RBW_Resos_Client::get_instance();
        $opening_hours = $client->get_opening_hours($date);

        if (is_wp_error($opening_hours)) {
            return new WP_REST_Response(array(
                'error' => $opening_hours->get_error_message(),
            ), 502);
        }

        $periods = array();
        foreach ($opening_hours as $period) {
            $parsed = RBW_Closeout_Parser::parse($period['name'] ?? '');

            $periods[] = array(
                'id'              => $period['_id'] ?? '',
                'name'            => $parsed['clean_name'],
                'from'            => $period['from'] ?? '',
                'to'              => $period['to'] ?? '',
                'is_special'      => !empty($period['isSpecial']),
                'resident_only'   => $parsed['resident_only'],
                'display_message' => $parsed['display_message'],
            );
        }

        return new WP_REST_Response($periods, 200);
    }

    /**
     * POST /rbw/v1/available-times
     */
    public function get_available_times($request) {
        $ip = RBW_Rate_Limiter::get_client_ip();
        if (!RBW_Rate_Limiter::check($ip, 'read')) {
            return new WP_REST_Response(array('error' => 'Rate limit exceeded'), 429);
        }

        $date = $request->get_param('date');
        $people = $request->get_param('people');
        $opening_hour_id = $request->get_param('opening_hour_id');

        $client = RBW_Resos_Client::get_instance();
        $result = $client->get_available_times($date, $people, $opening_hour_id);

        if (is_wp_error($result)) {
            return new WP_REST_Response(array(
                'error' => $result->get_error_message(),
            ), 502);
        }

        if (!is_array($result) || empty($result)) {
            return new WP_REST_Response(array(
                'times' => array(),
                'activeCustomFields' => array(),
            ), 200);
        }

        // The response is an array of period objects; find the matching one
        $period_data = null;
        foreach ($result as $item) {
            if (isset($item['_id']) && $item['_id'] === $opening_hour_id) {
                $period_data = $item;
                break;
            }
        }

        // If only one result and no ID match, use it
        if (!$period_data && count($result) === 1) {
            $period_data = $result[0];
        }

        if (!$period_data) {
            return new WP_REST_Response(array(
                'times' => array(),
                'activeCustomFields' => array(),
            ), 200);
        }

        $times = $period_data['availableTimes'] ?? array();
        $custom_fields = $period_data['activeCustomFields'] ?? array();

        // Filter out pre-mapped fields (Hotel Guest, Booking #)
        $mapped_ids = array_filter(array(
            get_option('rbw_field_hotel_guest', ''),
            get_option('rbw_field_booking_ref', ''),
        ));

        if (!empty($mapped_ids)) {
            $custom_fields = array_values(array_filter($custom_fields, function($field) use ($mapped_ids) {
                return !in_array($field['_id'] ?? '', $mapped_ids, true);
            }));
        }

        return new WP_REST_Response(array(
            'times'              => $times,
            'activeCustomFields' => $custom_fields,
        ), 200);
    }

    /**
     * POST /rbw/v1/create-booking
     */
    public function create_booking($request) {
        $ip = RBW_Rate_Limiter::get_client_ip();
        if (!RBW_Rate_Limiter::check($ip, 'write')) {
            return new WP_REST_Response(array('error' => 'Rate limit exceeded'), 429);
        }

        // Verify Turnstile token
        $turnstile_token = $request->get_param('turnstile_token');
        $turnstile_secret = get_option('rbw_turnstile_secret', '');

        if (!empty($turnstile_secret)) {
            if (empty($turnstile_token)) {
                return new WP_REST_Response(array('error' => 'Verification required'), 400);
            }

            $verify = $this->verify_turnstile($turnstile_token, $turnstile_secret, $ip);
            if (!$verify) {
                return new WP_REST_Response(array('error' => 'Verification failed'), 403);
            }
        }

        $date = $request->get_param('date');
        $time = $request->get_param('time');
        $people = $request->get_param('people');
        $name = $request->get_param('name');
        $email = $request->get_param('email');
        $phone = $request->get_param('phone') ?: '';
        $notes = $request->get_param('notes') ?: '';
        $custom_fields_input = $request->get_param('custom_fields');
        $force_duplicate = $request->get_param('force_duplicate');

        // Validate email
        if (!is_email($email)) {
            return new WP_REST_Response(array('error' => 'Invalid email address'), 400);
        }

        // Duplicate check
        if (!$force_duplicate) {
            $dupe = RBW_Duplicate_Checker::check($date, $email, $phone);
            if ($dupe['duplicate']) {
                return new WP_REST_Response(array(
                    'duplicate'       => true,
                    'existing_time'   => $dupe['existing_time'],
                    'existing_people' => $dupe['existing_people'],
                ), 200);
            }
        }

        // Build custom fields array
        $custom_fields = array();

        // Add dynamic custom fields from guest form
        if (is_array($custom_fields_input)) {
            foreach ($custom_fields_input as $field) {
                if (isset($field['_id'])) {
                    $custom_fields[] = $field;
                }
            }
        }

        // Note: Pre-mapped fields (Hotel Guest, Booking #) are NOT added in Phase 1.
        // They will be added in Phase 2/3 when resident detection is implemented.

        // Format phone
        $formatted_phone = RBW_Resos_Client::format_phone($phone);

        // Build booking payload
        $booking_data = array(
            'date'             => $date,
            'time'             => $time,
            'people'           => intval($people),
            'guest'            => array(
                'name'              => $name,
                'email'             => $email,
                'notificationEmail' => true,
            ),
            'sendNotification' => true,
            'source'           => 'website',
        );

        if (!empty($formatted_phone)) {
            $booking_data['guest']['phone'] = $formatted_phone;
        }

        if (!empty($notes)) {
            $booking_data['notes'] = $notes;
        }

        if (!empty($custom_fields)) {
            $booking_data['customFields'] = $custom_fields;
        }

        // Create booking
        $client = RBW_Resos_Client::get_instance();
        $result = $client->create_booking($booking_data);

        if (is_wp_error($result)) {
            return new WP_REST_Response(array(
                'error' => 'Failed to create booking: ' . $result->get_error_message(),
            ), 502);
        }

        // Result is the booking ID (plain string) or an object
        $booking_id = is_string($result) ? trim($result, '"') : ($result['_id'] ?? '');

        return new WP_REST_Response(array(
            'success'    => true,
            'booking_id' => $booking_id,
        ), 200);
    }

    /**
     * Verify a Cloudflare Turnstile token.
     */
    private function verify_turnstile($token, $secret, $ip) {
        $response = wp_remote_post('https://challenges.cloudflare.com/turnstile/v0/siteverify', array(
            'body' => array(
                'secret'   => $secret,
                'response' => $token,
                'remoteip' => $ip,
            ),
        ));

        if (is_wp_error($response)) {
            return false;
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        return !empty($body['success']);
    }
}
