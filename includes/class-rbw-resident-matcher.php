<?php
if (!defined('ABSPATH')) {
    exit;
}

class RBW_Resident_Matcher {

    private static $CACHE_TTL = 300; // 5 minutes

    /**
     * Get the staying list for a date, with transient caching.
     *
     * @param string $date Y-m-d
     * @return array|false Array of staying bookings, or false on failure
     */
    public static function get_staying_list($date) {
        $cache_key = 'rbw_staying_' . $date;
        $cached = get_transient($cache_key);

        if ($cached !== false) {
            return $cached;
        }

        $client = RBW_NewBook_Client::get_instance();
        $result = $client->get_staying_guests($date);

        if (is_wp_error($result)) {
            return false;
        }

        // Filter out cancelled bookings
        $active = array_filter($result, function($booking) {
            $status = strtolower($booking['booking_status'] ?? '');
            return !in_array($status, array('cancelled', 'canceled'), true);
        });

        $active = array_values($active);
        set_transient($cache_key, $active, self::$CACHE_TTL);

        return $active;
    }

    /**
     * Prefetch staying list for a date (called on date selection).
     * This is fire-and-forget; errors are swallowed.
     *
     * @param string $date Y-m-d
     */
    public static function prefetch_staying_list($date) {
        self::get_staying_list($date);
    }

    /**
     * Match a guest against the staying list for a date.
     *
     * @param string $date
     * @param string $name  Full name (e.g., "John Smith")
     * @param string $email
     * @param string $phone Optional
     * @return array Match result with tier and booking info
     */
    public static function match_guest($date, $name, $email, $phone = '') {
        $staying = self::get_staying_list($date);
        if ($staying === false || empty($staying)) {
            return array('match_tier' => 0, 'message' => 'staying_list_unavailable');
        }

        // Parse the guest name
        $name_parts = self::parse_name($name);
        $guest_lastname = $name_parts['last'];
        $guest_firstname = $name_parts['first'];
        $guest_email = strtolower(trim($email));
        $guest_phone_norm = RBW_Resident_Lookup::normalise_phone($phone);

        $surname_matches = array();
        $email_matches = array();

        foreach ($staying as $booking) {
            $primary = RBW_NewBook_Client::get_primary_guest($booking);
            if (!$primary) continue;

            $nb_lastname = strtolower(trim($primary['lastname'] ?? ''));
            $nb_email = strtolower(trim(RBW_NewBook_Client::get_guest_contact($primary, 'email')));

            // Check surname match
            $surname_match = !empty($nb_lastname) && !empty($guest_lastname) && $nb_lastname === $guest_lastname;

            // Check email match
            $email_match = !empty($nb_email) && !empty($guest_email) && $nb_email === $guest_email;

            if ($surname_match) {
                $surname_matches[] = $booking;
            }
            if ($email_match) {
                $email_matches[] = $booking;
            }

            // Tier 1: Email + Last Name match
            if ($surname_match && $email_match) {
                return self::build_match_result(1, $booking, $primary, $date);
            }
        }

        // Tier 2: Surname matches but email doesn't — phone verification needed
        if (!empty($surname_matches)) {
            // If multiple surname matches, use firstname as tiebreaker
            $best_match = null;
            foreach ($surname_matches as $booking) {
                $primary = RBW_NewBook_Client::get_primary_guest($booking);
                if (!$primary) continue;

                $nb_firstname = strtolower(trim($primary['firstname'] ?? ''));
                if (!empty($guest_firstname) && $nb_firstname === strtolower($guest_firstname)) {
                    $best_match = $booking;
                    break;
                }
            }
            if (!$best_match) {
                $best_match = $surname_matches[0];
            }

            $primary = RBW_NewBook_Client::get_primary_guest($best_match);
            $nb_phone = RBW_NewBook_Client::get_guest_contact($primary, 'mobile')
                     ?: RBW_NewBook_Client::get_guest_contact($primary, 'phone');
            $has_phone = !empty($nb_phone);

            return array_merge(
                self::build_match_result(2, $best_match, $primary, $date),
                array('phone_on_file' => $has_phone)
            );
        }

        // Tier 3: No match
        return array('match_tier' => 3);
    }

    /**
     * Verify phone for a Tier 2 partial match.
     *
     * @param string $date
     * @param string $name
     * @param string $phone
     * @return array
     */
    public static function verify_phone($date, $name, $phone) {
        $staying = self::get_staying_list($date);
        if ($staying === false) {
            return array('verified' => false);
        }

        $name_parts = self::parse_name($name);
        $guest_lastname = $name_parts['last'];
        $phone_norm = RBW_Resident_Lookup::normalise_phone($phone);

        if (empty($phone_norm)) {
            return array('verified' => false);
        }

        foreach ($staying as $booking) {
            $primary = RBW_NewBook_Client::get_primary_guest($booking);
            if (!$primary) continue;

            $nb_lastname = strtolower(trim($primary['lastname'] ?? ''));
            if (empty($nb_lastname) || $nb_lastname !== $guest_lastname) continue;

            $nb_phone = RBW_NewBook_Client::get_guest_contact($primary, 'mobile')
                     ?: RBW_NewBook_Client::get_guest_contact($primary, 'phone');
            $nb_phone_norm = RBW_Resident_Lookup::normalise_phone($nb_phone);

            if (!empty($nb_phone_norm) && $nb_phone_norm === $phone_norm) {
                $result = self::build_match_result(1, $booking, $primary, $date);
                $result['verified'] = true;
                return $result;
            }
        }

        return array('verified' => false);
    }

    /**
     * Verify a manually entered booking reference against staying list.
     *
     * @param string $date
     * @param string $reference
     * @return array
     */
    public static function verify_reference($date, $reference) {
        $staying = self::get_staying_list($date);
        if ($staying === false) {
            return array('verified' => false);
        }

        $reference = trim($reference);

        foreach ($staying as $booking) {
            $bid = strval($booking['booking_id'] ?? '');
            $bref = trim($booking['booking_reference_id'] ?? '');

            // Direct booking ID match
            if ($bid === $reference) {
                $primary = RBW_NewBook_Client::get_primary_guest($booking);
                $result = self::build_match_result(1, $booking, $primary, $date);
                $result['verified'] = true;
                return $result;
            }

            // OTA / agent reference match
            if (!empty($bref) && $bref === $reference) {
                $primary = RBW_NewBook_Client::get_primary_guest($booking);
                $result = self::build_match_result(1, $booking, $primary, $date);
                $result['verified'] = true;
                $result['ota_match'] = true;
                $result['travel_agent_name'] = $booking['travel_agent_name'] ?? '';
                $result['internal_booking_id'] = intval($booking['booking_id']);
                return $result;
            }
        }

        return array('verified' => false);
    }

    /**
     * Check group booking status for a matched resident.
     *
     * @param string $date
     * @param int    $booking_id    The matched resident's NewBook booking ID
     * @param int    $group_id      The bookings_group_id
     * @param int    $covers        The number of covers the guest selected
     * @return array Group info
     */
    public static function check_group($date, $booking_id, $group_id, $covers) {
        if (empty($group_id)) {
            return array('is_group' => false);
        }

        $staying = self::get_staying_list($date);
        if ($staying === false) {
            return array('is_group' => false);
        }

        // Find all group members from staying list
        $group_members = array();
        $group_occupancy_total = 0;
        foreach ($staying as $booking) {
            if (!empty($booking['bookings_group_id']) && intval($booking['bookings_group_id']) === intval($group_id)) {
                $group_members[] = $booking;
                $group_occupancy_total += RBW_NewBook_Client::get_total_guests($booking);
            }
        }

        if (count($group_members) <= 1) {
            return array('is_group' => false);
        }

        // Check resOS bookings for existing group table bookings
        $resos = RBW_Resos_Client::get_instance();
        $resos_bookings = $resos->get_bookings_for_date($date);
        $existing_tables = array();

        if (!is_wp_error($resos_bookings)) {
            $booking_ref_field = get_option('rbw_field_booking_ref', '');
            $group_member_ids = array_map(function($b) { return strval($b['booking_id']); }, $group_members);

            foreach ($resos_bookings as $rb) {
                if (empty($rb['customFields']) || !is_array($rb['customFields'])) continue;

                foreach ($rb['customFields'] as $cf) {
                    if (($cf['_id'] ?? '') === $booking_ref_field && !empty($cf['value'])) {
                        $ref_val = trim($cf['value']);
                        if (in_array($ref_val, $group_member_ids, true) && $ref_val !== strval($booking_id)) {
                            $existing_tables[] = array(
                                'newbook_booking_id' => $ref_val,
                                'covers'             => intval($rb['people'] ?? 0),
                            );
                        }
                    }
                }
            }
        }

        // Determine occupancy for each group member
        $guest_occupancy = 0;
        foreach ($group_members as $member) {
            if (intval($member['booking_id']) === intval($booking_id)) {
                $guest_occupancy = RBW_NewBook_Client::get_total_guests($member);
                break;
            }
        }

        return array(
            'is_group'              => true,
            'group_size'            => count($group_members),
            'group_occupancy_total' => $group_occupancy_total,
            'guest_occupancy'       => $guest_occupancy,
            'existing_tables'       => $existing_tables,
        );
    }

    // ---- Private helpers ----

    private static function parse_name($name) {
        $name = trim($name);
        if (empty($name)) {
            return array('first' => '', 'last' => '');
        }
        $parts = preg_split('/\s+/', $name);
        if (count($parts) === 1) {
            return array('first' => '', 'last' => strtolower($parts[0]));
        }
        $last = strtolower(array_pop($parts));
        $first = implode(' ', $parts);
        return array('first' => $first, 'last' => $last);
    }

    private static function build_match_result($tier, $booking, $guest, $date) {
        $stay = RBW_NewBook_Client::get_stay_dates($booking);
        $occupancy = RBW_NewBook_Client::get_total_guests($booking);

        return array(
            'match_tier'           => $tier,
            'booking_id'           => intval($booking['booking_id']),
            'booking_reference_id' => $booking['booking_reference_id'] ?? '',
            'check_in'             => $stay['check_in'],
            'check_out'            => $stay['check_out'],
            'nights'               => $stay['nights'],
            'room'                 => $booking['site_name'] ?? '',
            'occupancy'            => $occupancy,
            'group_id'             => !empty($booking['bookings_group_id']) ? intval($booking['bookings_group_id']) : null,
        );
    }
}
