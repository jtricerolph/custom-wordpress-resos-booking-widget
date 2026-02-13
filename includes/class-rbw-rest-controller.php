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

        // Phase 2: Resident verification
        register_rest_route($this->namespace, '/verify-resident', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'verify_resident'),
            'permission_callback' => '__return_true',
            'args'                => array(
                'bid'     => array('required' => true, 'sanitize_callback' => 'absint'),
                'gid'     => array('required' => false, 'sanitize_callback' => 'absint'),
                'surname' => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                'email'   => array('required' => false, 'sanitize_callback' => 'sanitize_email'),
                'phone'   => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
            ),
        ));

        // Phase 2: Batch time slots for multi-day stay planner
        register_rest_route($this->namespace, '/available-times-multi', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'get_available_times_multi'),
            'permission_callback' => '__return_true',
            'args'                => array(
                'dates'  => array('required' => true),
                'people' => array('required' => true, 'sanitize_callback' => 'absint'),
                'resident_booking_id' => array('required' => false, 'sanitize_callback' => 'absint'),
            ),
        ));

        // Phase 2: Batch booking creation for stay planner
        register_rest_route($this->namespace, '/create-bookings-batch', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'create_bookings_batch'),
            'permission_callback' => '__return_true',
            'args'                => array(
                'bookings'            => array('required' => true),
                'name'                => array('required' => true, 'sanitize_callback' => 'sanitize_text_field'),
                'email'               => array('required' => true, 'sanitize_callback' => 'sanitize_email'),
                'phone'               => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                'notes'               => array('required' => false, 'sanitize_callback' => 'sanitize_textarea_field'),
                'custom_fields'       => array('required' => false),
                'resident_booking_id' => array('required' => false, 'sanitize_callback' => 'absint'),
                'turnstile_token'     => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
            ),
        ));

        // Phase 2: Mark nights as "no table needed" in NewBook
        register_rest_route($this->namespace, '/mark-no-table', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'mark_no_table'),
            'permission_callback' => '__return_true',
            'args'                => array(
                'booking_id' => array('required' => true, 'sanitize_callback' => 'absint'),
                'dates'      => array('required' => true),
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

    // ---- Phase 2 Endpoints ----

    /**
     * POST /rbw/v1/verify-resident
     * Verify a resident from a direct link (bid + gid/surname/email/phone).
     */
    public function verify_resident($request) {
        $ip = RBW_Rate_Limiter::get_client_ip();
        if (!RBW_Rate_Limiter::check($ip, 'resident')) {
            return new WP_REST_Response(array('error' => 'Rate limit exceeded'), 429);
        }

        $bid     = $request->get_param('bid');
        $gid     = $request->get_param('gid');
        $surname = $request->get_param('surname') ?: '';
        $email   = $request->get_param('email') ?: '';
        $phone   = $request->get_param('phone') ?: '';

        if (!$bid) {
            return new WP_REST_Response(array('error' => 'Booking ID is required'), 400);
        }

        // At least one second factor required
        if (!$gid && !$surname && !$email && !$phone) {
            return new WP_REST_Response(array('error' => 'Verification factor required'), 400);
        }

        $result = RBW_Resident_Lookup::verify_from_link($bid, $gid, $surname, $email, $phone);

        if (is_wp_error($result)) {
            return new WP_REST_Response(array(
                'verified' => false,
                'error'    => $result->get_error_message(),
            ), 200);
        }

        return new WP_REST_Response($result, 200);
    }

    /**
     * POST /rbw/v1/available-times-multi
     * Get available times for multiple dates at once (stay planner).
     */
    public function get_available_times_multi($request) {
        $ip = RBW_Rate_Limiter::get_client_ip();
        if (!RBW_Rate_Limiter::check($ip, 'read')) {
            return new WP_REST_Response(array('error' => 'Rate limit exceeded'), 429);
        }

        $dates  = $request->get_param('dates');
        $people = $request->get_param('people');
        $resident_booking_id = $request->get_param('resident_booking_id');

        if (!is_array($dates) || empty($dates)) {
            return new WP_REST_Response(array('error' => 'Dates array required'), 400);
        }

        // Limit to max 14 dates to prevent abuse
        $dates = array_slice($dates, 0, 14);

        $client = RBW_Resos_Client::get_instance();
        $result = array();

        // For residents, pass onlyBookableOnline: false to bypass RESIDENTONLY restrictions
        $online_only = empty($resident_booking_id);

        foreach ($dates as $date) {
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
                continue;
            }

            // Get opening hours for the date
            $opening_hours = $client->get_opening_hours($date);
            if (is_wp_error($opening_hours)) {
                $result[$date] = array('error' => true, 'periods' => array());
                continue;
            }

            $date_periods = array();
            foreach ($opening_hours as $period) {
                $parsed = RBW_Closeout_Parser::parse($period['name'] ?? '');

                // For residents, skip the resident_only check
                $is_closed = !empty($resident_booking_id) ? false : ($parsed['resident_only'] || !empty($parsed['display_message']));

                $period_info = array(
                    'id'              => $period['_id'] ?? '',
                    'name'            => $parsed['clean_name'],
                    'from'            => $period['from'] ?? '',
                    'to'              => $period['to'] ?? '',
                    'is_special'      => !empty($period['isSpecial']),
                    'resident_only'   => $parsed['resident_only'],
                    'display_message' => $parsed['display_message'],
                    'times'           => array(),
                );

                // Fetch times for non-closed periods
                if (!$is_closed) {
                    $times_result = $client->get_available_times($date, $people, $period['_id'] ?? '', $online_only);
                    if (!is_wp_error($times_result) && is_array($times_result)) {
                        // Find matching period in response
                        foreach ($times_result as $item) {
                            if (isset($item['_id']) && $item['_id'] === ($period['_id'] ?? '')) {
                                $period_info['times'] = $item['availableTimes'] ?? array();
                                break;
                            }
                        }
                        if (empty($period_info['times']) && count($times_result) === 1) {
                            $period_info['times'] = $times_result[0]['availableTimes'] ?? array();
                        }
                    }
                }

                $date_periods[] = $period_info;
            }

            $result[$date] = array('error' => false, 'periods' => $date_periods);
        }

        return new WP_REST_Response($result, 200);
    }

    /**
     * POST /rbw/v1/create-bookings-batch
     * Create multiple bookings at once (stay planner).
     */
    public function create_bookings_batch($request) {
        $ip = RBW_Rate_Limiter::get_client_ip();
        if (!RBW_Rate_Limiter::check($ip, 'write')) {
            return new WP_REST_Response(array('error' => 'Rate limit exceeded'), 429);
        }

        // Verify Turnstile
        $turnstile_token = $request->get_param('turnstile_token');
        $turnstile_secret = get_option('rbw_turnstile_secret', '');
        if (!empty($turnstile_secret)) {
            if (empty($turnstile_token)) {
                return new WP_REST_Response(array('error' => 'Verification required'), 400);
            }
            if (!$this->verify_turnstile($turnstile_token, $turnstile_secret, $ip)) {
                return new WP_REST_Response(array('error' => 'Verification failed'), 403);
            }
        }

        $bookings = $request->get_param('bookings');
        $name     = $request->get_param('name');
        $email    = $request->get_param('email');
        $phone    = $request->get_param('phone') ?: '';
        $notes    = $request->get_param('notes') ?: '';
        $custom_fields_input = $request->get_param('custom_fields');
        $resident_booking_id = $request->get_param('resident_booking_id');

        if (!is_array($bookings) || empty($bookings)) {
            return new WP_REST_Response(array('error' => 'At least one booking required'), 400);
        }

        if (!is_email($email)) {
            return new WP_REST_Response(array('error' => 'Invalid email'), 400);
        }

        // Limit batch size
        $bookings = array_slice($bookings, 0, 14);

        $formatted_phone = RBW_Resos_Client::format_phone($phone);
        $client = RBW_Resos_Client::get_instance();

        // Build custom fields (dynamic + pre-mapped for resident)
        $base_custom_fields = array();
        if (is_array($custom_fields_input)) {
            foreach ($custom_fields_input as $field) {
                if (isset($field['_id'])) {
                    $base_custom_fields[] = $field;
                }
            }
        }

        // Add pre-mapped fields for verified residents
        if ($resident_booking_id) {
            $hotel_guest_field = get_option('rbw_field_hotel_guest', '');
            $hotel_guest_yes   = get_option('rbw_field_hotel_guest_yes_choice', '');
            $booking_ref_field = get_option('rbw_field_booking_ref', '');

            if ($hotel_guest_field && $hotel_guest_yes) {
                $base_custom_fields[] = array(
                    '_id'                     => $hotel_guest_field,
                    'name'                    => 'Hotel Guest',
                    'value'                   => $hotel_guest_yes,
                    'multipleChoiceValueName' => 'Yes',
                );
            }
            if ($booking_ref_field) {
                $base_custom_fields[] = array(
                    '_id'   => $booking_ref_field,
                    'name'  => 'Booking #',
                    'value' => strval($resident_booking_id),
                );
            }
        }

        $results = array();
        foreach ($bookings as $booking) {
            $b_date   = sanitize_text_field($booking['date'] ?? '');
            $b_time   = sanitize_text_field($booking['time'] ?? '');
            $b_people = intval($booking['people'] ?? 0);

            if (!$b_date || !$b_time || !$b_people) {
                $results[] = array('date' => $b_date, 'success' => false, 'error' => 'Missing required fields');
                continue;
            }

            $booking_data = array(
                'date'             => $b_date,
                'time'             => $b_time,
                'people'           => $b_people,
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
            if (!empty($base_custom_fields)) {
                $booking_data['customFields'] = $base_custom_fields;
            }

            $result = $client->create_booking($booking_data);
            if (is_wp_error($result)) {
                $results[] = array('date' => $b_date, 'success' => false, 'error' => $result->get_error_message());
            } else {
                $booking_id = is_string($result) ? trim($result, '"') : ($result['_id'] ?? '');
                $results[] = array('date' => $b_date, 'success' => true, 'booking_id' => $booking_id);
            }
        }

        return new WP_REST_Response(array(
            'results' => $results,
        ), 200);
    }

    /**
     * POST /rbw/v1/mark-no-table
     * Mark specific stay dates as "no table needed" in NewBook.
     */
    public function mark_no_table($request) {
        $ip = RBW_Rate_Limiter::get_client_ip();
        if (!RBW_Rate_Limiter::check($ip, 'write')) {
            return new WP_REST_Response(array('error' => 'Rate limit exceeded'), 429);
        }

        $booking_id = $request->get_param('booking_id');
        $dates      = $request->get_param('dates');

        if (!$booking_id || !is_array($dates) || empty($dates)) {
            return new WP_REST_Response(array('error' => 'Booking ID and dates required'), 400);
        }

        $newbook = RBW_NewBook_Client::get_instance();

        // Build the value string for the custom field
        $no_table_dates = implode(', ', array_map('sanitize_text_field', $dates));
        $result = $newbook->update_custom_field(
            $booking_id,
            'Restaurant Status',
            'No table needed: ' . $no_table_dates
        );

        if (is_wp_error($result)) {
            return new WP_REST_Response(array(
                'success' => false,
                'error'   => $result->get_error_message(),
            ), 502);
        }

        return new WP_REST_Response(array('success' => true), 200);
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
