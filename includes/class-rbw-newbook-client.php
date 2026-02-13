<?php
if (!defined('ABSPATH')) {
    exit;
}

class RBW_NewBook_Client {

    private static $instance = null;
    private $api_base_url = 'https://api.newbook.cloud/rest/';

    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function get_credentials() {
        return array(
            'username' => get_option('rbw_newbook_username', ''),
            'password' => get_option('rbw_newbook_password', ''),
            'api_key'  => get_option('rbw_newbook_api_key', ''),
            'region'   => get_option('rbw_newbook_region', 'au'),
        );
    }

    private function request($action, $data = array()) {
        $creds = $this->get_credentials();

        if (empty($creds['username']) || empty($creds['password']) || empty($creds['api_key'])) {
            return new WP_Error('rbw_newbook_no_credentials', 'NewBook credentials not configured');
        }

        $data['region']  = $creds['region'];
        $data['api_key'] = $creds['api_key'];

        $url = $this->api_base_url . $action;

        $response = wp_remote_post($url, array(
            'headers' => array(
                'Content-Type'  => 'application/json',
                'Authorization' => 'Basic ' . base64_encode($creds['username'] . ':' . $creds['password']),
            ),
            'body'    => wp_json_encode($data),
            'timeout' => 15,
        ));

        if (is_wp_error($response)) {
            return $response;
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);

        if ($code !== 200) {
            return new WP_Error('rbw_newbook_api_error', "NewBook API returned status {$code}");
        }

        $parsed = json_decode($body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return new WP_Error('rbw_newbook_json_error', 'Invalid JSON from NewBook API');
        }

        if (isset($parsed['success']) && $parsed['success'] === false) {
            $msg = isset($parsed['message']) ? $parsed['message'] : 'NewBook API returned an error';
            return new WP_Error('rbw_newbook_api_fail', $msg);
        }

        return isset($parsed['data']) ? $parsed['data'] : $parsed;
    }

    /**
     * Get a single booking by ID.
     *
     * @param int $booking_id
     * @return array|WP_Error Booking data or error
     */
    public function get_booking($booking_id) {
        return $this->request('bookings_get', array(
            'booking_id' => intval($booking_id),
        ));
    }

    /**
     * Get guests staying on a specific date.
     *
     * @param string $date Y-m-d format
     * @return array|WP_Error Array of booking objects or error
     */
    public function get_staying_guests($date) {
        $result = $this->request('bookings_list', array(
            'period_from' => $date . ' 00:00:00',
            'period_to'   => $date . ' 23:59:59',
            'list_type'   => 'staying',
        ));

        if (is_wp_error($result)) {
            return $result;
        }

        return is_array($result) ? $result : array();
    }

    /**
     * Update a custom field on a NewBook booking.
     *
     * @param int    $booking_id
     * @param string $field_name
     * @param mixed  $value
     * @return array|WP_Error
     */
    public function update_custom_field($booking_id, $field_name, $value) {
        return $this->request('instance_custom_fields_set', array(
            'instance_id'   => intval($booking_id),
            'instance_type' => 'booking',
            'fields'        => array(
                array(
                    'name'  => $field_name,
                    'value' => $value,
                ),
            ),
        ));
    }

    /**
     * Test connection with current credentials.
     *
     * @return true|WP_Error
     */
    public function test_connection() {
        $result = $this->request('sites_list', array());
        if (is_wp_error($result)) {
            return $result;
        }
        return true;
    }

    // ---- Helper methods for extracting guest data from booking responses ----

    /**
     * Get the primary guest from a booking.
     *
     * @param array $booking
     * @return array|null Guest object or null
     */
    public static function get_primary_guest($booking) {
        if (empty($booking['guests']) || !is_array($booking['guests'])) {
            return null;
        }
        // Look for primary_client = '1', fallback to first guest
        foreach ($booking['guests'] as $guest) {
            if (!empty($guest['primary_client']) && $guest['primary_client'] === '1') {
                return $guest;
            }
        }
        return $booking['guests'][0];
    }

    /**
     * Get a contact detail from a guest.
     *
     * @param array  $guest Guest object
     * @param string $type  Contact type: 'email', 'phone', 'mobile'
     * @return string
     */
    public static function get_guest_contact($guest, $type) {
        if (empty($guest['contact_details']) || !is_array($guest['contact_details'])) {
            return '';
        }
        foreach ($guest['contact_details'] as $contact) {
            if (isset($contact['type']) && $contact['type'] === $type) {
                return isset($contact['content']) ? $contact['content'] : '';
            }
        }
        return '';
    }

    /**
     * Get the full guest name.
     *
     * @param array $guest Guest object
     * @return string
     */
    public static function get_guest_name($guest) {
        $first = isset($guest['firstname']) ? trim($guest['firstname']) : '';
        $last  = isset($guest['lastname']) ? trim($guest['lastname']) : '';
        return trim($first . ' ' . $last);
    }

    /**
     * Get total guest count from a booking.
     *
     * @param array $booking
     * @return int
     */
    public static function get_total_guests($booking) {
        return intval($booking['booking_adults'] ?? 0)
             + intval($booking['booking_children'] ?? 0)
             + intval($booking['booking_infants'] ?? 0);
    }

    /**
     * Get stay dates as an array of Y-m-d strings.
     *
     * @param array $booking
     * @return array ['check_in' => Y-m-d, 'check_out' => Y-m-d, 'nights' => [Y-m-d, ...]]
     */
    public static function get_stay_dates($booking) {
        $check_in  = substr($booking['period_from'] ?? '', 0, 10);
        $check_out = substr($booking['period_to'] ?? '', 0, 10);

        $nights = array();
        if ($check_in && $check_out) {
            $current = new DateTime($check_in);
            $end     = new DateTime($check_out);
            while ($current < $end) {
                $nights[] = $current->format('Y-m-d');
                $current->modify('+1 day');
            }
        }

        return array(
            'check_in'  => $check_in,
            'check_out' => $check_out,
            'nights'    => $nights,
        );
    }
}
