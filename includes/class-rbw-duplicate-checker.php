<?php
if (!defined('ABSPATH')) {
    exit;
}

class RBW_Duplicate_Checker {

    /**
     * Check for existing bookings on a date matching the guest's email or phone.
     *
     * @param string $date  Date in YYYY-MM-DD format.
     * @param string $email Guest email.
     * @param string $phone Guest phone (optional).
     * @return array { duplicate: bool, existing_time?: string, existing_people?: int }
     */
    public static function check($date, $email, $phone = '') {
        $client = RBW_Resos_Client::get_instance();
        $bookings = $client->get_bookings_for_date($date);

        if (is_wp_error($bookings)) {
            // If we can't check, allow the booking to proceed
            return array('duplicate' => false);
        }

        $email_lower = strtolower(trim($email));
        $phone_normalised = self::normalise_phone($phone);

        foreach ($bookings as $booking) {
            if (empty($booking['guest'])) {
                continue;
            }

            $guest = $booking['guest'];

            // Check email match
            $email_match = false;
            if (!empty($guest['email']) && strtolower(trim($guest['email'])) === $email_lower) {
                $email_match = true;
            }

            // Check phone match
            $phone_match = false;
            if (!empty($phone_normalised) && !empty($guest['phone'])) {
                $guest_phone = self::normalise_phone($guest['phone']);
                if ($guest_phone === $phone_normalised) {
                    $phone_match = true;
                }
            }

            if ($email_match || $phone_match) {
                return array(
                    'duplicate'       => true,
                    'existing_time'   => $booking['time'] ?? '',
                    'existing_people' => $booking['people'] ?? 0,
                );
            }
        }

        return array('duplicate' => false);
    }

    /**
     * Normalise phone to last 9 digits for comparison.
     * Handles +44, 0044, 07xxx variations.
     */
    public static function normalise_phone($phone) {
        if (empty($phone)) {
            return '';
        }

        $digits = preg_replace('/\D/', '', $phone);

        if (strlen($digits) < 9) {
            return $digits;
        }

        return substr($digits, -9);
    }
}
