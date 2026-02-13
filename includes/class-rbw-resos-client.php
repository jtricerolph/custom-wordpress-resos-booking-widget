<?php
if (!defined('ABSPATH')) {
    exit;
}

class RBW_Resos_Client {

    private static $instance = null;
    private $api_key;
    private $base_url = 'https://api.resos.com/v1';

    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->api_key = get_option('rbw_resos_api_key', '');
    }

    private function get_auth_header() {
        return 'Basic ' . base64_encode($this->api_key . ':');
    }

    private function request($method, $endpoint, $params = array(), $body = null) {
        if (empty($this->api_key)) {
            return new WP_Error('rbw_no_api_key', 'ResOS API key is not configured');
        }

        $url = $this->base_url . $endpoint;

        if (!empty($params) && $method === 'GET') {
            $url = add_query_arg($params, $url);
        }

        $args = array(
            'method'  => $method,
            'timeout' => 30,
            'headers' => array(
                'Authorization' => $this->get_auth_header(),
                'Content-Type'  => 'application/json',
            ),
        );

        if ($body !== null && $method !== 'GET') {
            $args['body'] = wp_json_encode($body);
        }

        $response = ($method === 'GET')
            ? wp_remote_get($url, $args)
            : wp_remote_request($url, $args);

        if (is_wp_error($response)) {
            return $response;
        }

        $code = wp_remote_retrieve_response_code($response);
        $response_body = wp_remote_retrieve_body($response);

        if ($code < 200 || $code >= 300) {
            return new WP_Error(
                'rbw_resos_api_error',
                'ResOS API returned status ' . $code,
                array('status' => $code, 'body' => $response_body)
            );
        }

        $data = json_decode($response_body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            // Some endpoints return plain strings (e.g., booking ID)
            return $response_body;
        }

        return $data;
    }

    /**
     * Get opening hours, optionally filtered to a specific date.
     */
    public function get_opening_hours($date = null) {
        $params = array(
            'showDeleted' => 'false',
            'onlySpecial' => 'false',
        );

        $result = $this->request('GET', '/openingHours', $params);

        if (is_wp_error($result)) {
            return $result;
        }

        if (!is_array($result)) {
            return array();
        }

        // If date provided, filter to periods active on that date
        if ($date) {
            $target = strtotime($date);
            $result = array_values(array_filter($result, function($period) use ($target, $date) {
                // Regular opening hours (not special) are always active
                if (empty($period['isSpecial'])) {
                    // Check if the period is active on the target day of week
                    if (!empty($period['activeDays'])) {
                        $day_of_week = strtolower(date('l', $target));
                        return !empty($period['activeDays'][$day_of_week]);
                    }
                    return true;
                }

                // Special events: check date range
                if (!empty($period['specialDate'])) {
                    $special_date = substr($period['specialDate'], 0, 10);
                    return $special_date === $date;
                }

                return false;
            }));
        }

        return $result;
    }

    /**
     * Get available time slots for a date/people/period combo.
     * Returns the full response including activeCustomFields.
     */
    public function get_available_times($date, $people, $opening_hour_id = null, $online_only = true) {
        $params = array(
            'date'               => $date,
            'people'             => $people,
            'onlyBookableOnline' => $online_only ? 'true' : 'false',
        );

        if ($opening_hour_id) {
            $params['openingHourId'] = $opening_hour_id;
        }

        return $this->request('GET', '/bookingFlow/times', $params);
    }

    /**
     * Get bookings for a date range, with pagination handling.
     */
    public function get_bookings_for_date($date) {
        $all_bookings = array();
        $page = 0;
        $limit = 100;

        do {
            $params = array(
                'fromDateTime' => $date . 'T00:00:00',
                'toDateTime'   => $date . 'T23:59:59',
                'limit'        => $limit,
                'skip'         => $page * $limit,
            );

            $result = $this->request('GET', '/bookings', $params);

            if (is_wp_error($result)) {
                return $result;
            }

            if (!is_array($result)) {
                break;
            }

            $all_bookings = array_merge($all_bookings, $result);
            $page++;
        } while (count($result) === $limit);

        return $all_bookings;
    }

    /**
     * Create a new booking.
     */
    public function create_booking($data) {
        return $this->request('POST', '/bookings', array(), $data);
    }

    /**
     * Get custom field definitions (admin settings only).
     */
    public function get_custom_fields() {
        return $this->request('GET', '/customFields');
    }

    /**
     * Format a UK phone number for resOS.
     * Strips leading 0, prepends +44.
     */
    public static function format_phone($phone) {
        if (empty($phone)) {
            return '';
        }

        // Strip everything except digits and +
        $phone = preg_replace('/[^\d+]/', '', $phone);

        // Already international format
        if (strpos($phone, '+') === 0) {
            return $phone;
        }

        // UK: strip leading 0, add +44
        if (strpos($phone, '0') === 0) {
            $phone = '+44' . substr($phone, 1);
        }

        // Just digits, assume UK without leading 0
        if (strpos($phone, '+') !== 0) {
            $phone = '+44' . $phone;
        }

        return $phone;
    }
}
