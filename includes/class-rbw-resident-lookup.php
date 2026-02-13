<?php
if (!defined('ABSPATH')) {
    exit;
}

class RBW_Resident_Lookup {

    /**
     * Verify a resident from a direct link (bid + gid).
     *
     * @param int    $booking_id NewBook booking ID
     * @param int    $guest_id   NewBook guest ID (second factor)
     * @param string $surname    Optional: alternative second factor
     * @param string $email      Optional: alternative second factor
     * @param string $phone      Optional: alternative second factor
     * @return array|WP_Error Resident data or error
     */
    public static function verify_from_link($booking_id, $guest_id = null, $surname = '', $email = '', $phone = '') {
        $client = RBW_NewBook_Client::get_instance();
        $booking = $client->get_booking($booking_id);

        if (is_wp_error($booking)) {
            return new WP_Error('rbw_verification_failed', 'Could not verify your booking. You can continue as a regular guest.');
        }

        // Check booking exists and is valid
        if (empty($booking) || !is_array($booking)) {
            return new WP_Error('rbw_booking_not_found', 'Booking not found.');
        }

        // Handle response — bookings_get may return the booking directly or wrapped
        $booking_data = isset($booking['booking_id']) ? $booking : (isset($booking[0]) ? $booking[0] : null);
        if (!$booking_data) {
            return new WP_Error('rbw_booking_not_found', 'Booking not found.');
        }

        // Check booking isn't cancelled
        $status = strtolower($booking_data['booking_status'] ?? '');
        if (in_array($status, array('cancelled', 'canceled'), true)) {
            return new WP_Error('rbw_booking_cancelled', 'This booking has been cancelled.');
        }

        // Verify second factor
        $verified = false;
        $matched_guest = null;

        if (!empty($booking_data['guests']) && is_array($booking_data['guests'])) {
            foreach ($booking_data['guests'] as $guest) {
                // Check by guest ID
                if ($guest_id && isset($guest['id']) && intval($guest['id']) === intval($guest_id)) {
                    $verified = true;
                    $matched_guest = $guest;
                    break;
                }

                // Check by surname
                if ($surname && !empty($guest['lastname'])) {
                    if (strtolower(trim($guest['lastname'])) === strtolower(trim($surname))) {
                        $verified = true;
                        $matched_guest = $guest;
                        break;
                    }
                }

                // Check by email
                if ($email) {
                    $guest_email = RBW_NewBook_Client::get_guest_contact($guest, 'email');
                    if ($guest_email && strtolower(trim($guest_email)) === strtolower(trim($email))) {
                        $verified = true;
                        $matched_guest = $guest;
                        break;
                    }
                }

                // Check by phone (last 9 digits)
                if ($phone) {
                    $guest_phone = RBW_NewBook_Client::get_guest_contact($guest, 'mobile')
                                ?: RBW_NewBook_Client::get_guest_contact($guest, 'phone');
                    if ($guest_phone && self::normalise_phone($guest_phone) === self::normalise_phone($phone)) {
                        $verified = true;
                        $matched_guest = $guest;
                        break;
                    }
                }
            }
        }

        if (!$verified) {
            return new WP_Error('rbw_verification_failed', 'Could not verify your identity for this booking.');
        }

        // Build response
        $primary = $matched_guest ?: RBW_NewBook_Client::get_primary_guest($booking_data);
        $stay = RBW_NewBook_Client::get_stay_dates($booking_data);
        $guest_name = $primary ? RBW_NewBook_Client::get_guest_name($primary) : '';
        $guest_email = $primary ? RBW_NewBook_Client::get_guest_contact($primary, 'email') : '';
        $guest_phone = $primary ? (RBW_NewBook_Client::get_guest_contact($primary, 'mobile')
                                ?: RBW_NewBook_Client::get_guest_contact($primary, 'phone')) : '';
        $occupancy = RBW_NewBook_Client::get_total_guests($booking_data);

        return array(
            'verified'     => true,
            'guest_name'   => $guest_name,
            'guest_email'  => $guest_email,
            'guest_phone'  => $guest_phone,
            'room'         => $booking_data['site_name'] ?? '',
            'check_in'     => $stay['check_in'],
            'check_out'    => $stay['check_out'],
            'nights'       => $stay['nights'],
            'booking_id'   => intval($booking_data['booking_id']),
            'occupancy'    => $occupancy,
            'group_id'     => !empty($booking_data['bookings_group_id']) ? intval($booking_data['bookings_group_id']) : null,
        );
    }

    /**
     * Normalise a phone number to last 9 digits for comparison.
     *
     * @param string $phone
     * @return string
     */
    public static function normalise_phone($phone) {
        if (!$phone) return '';
        $digits = preg_replace('/\D/', '', $phone);
        return strlen($digits) >= 9 ? substr($digits, -9) : $digits;
    }
}
