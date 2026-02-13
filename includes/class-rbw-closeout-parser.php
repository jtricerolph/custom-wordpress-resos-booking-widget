<?php
if (!defined('ABSPATH')) {
    exit;
}

class RBW_Closeout_Parser {

    /**
     * Parse a resOS opening hour / special event name for closeout markers.
     *
     * Markers:
     *   ##RESIDENTONLY  — period restricted to verified hotel residents
     *   %%message%%     — guest-facing text between %% delimiters
     *
     * @param string $name The raw name from resOS.
     * @return array {
     *     resident_only:   bool   Whether ##RESIDENTONLY marker is present,
     *     display_message: string|null  Extracted %%message%% or null,
     *     clean_name:      string Name with markers stripped,
     * }
     */
    public static function parse($name) {
        $resident_only = false;
        $display_message = null;
        $clean_name = $name;

        // Check for ##RESIDENTONLY marker
        if (stripos($name, '##RESIDENTONLY') !== false) {
            $resident_only = true;
            $clean_name = str_ireplace('##RESIDENTONLY', '', $clean_name);
        }

        // Extract %%message%% marker
        if (preg_match('/%%(.+?)%%/s', $name, $matches)) {
            $display_message = trim($matches[1]);
            $clean_name = preg_replace('/%%(.+?)%%/s', '', $clean_name);
        }

        // If no custom message, use default from settings
        if ($display_message === null && ($resident_only || self::is_closure_name($name))) {
            $default = get_option('rbw_default_closeout_message', '');
            if (!empty($default)) {
                // Replace {phone} placeholder
                $phone = get_option('rbw_restaurant_phone', '');
                $display_message = str_replace('{phone}', $phone, $default);
            }
        }

        $clean_name = trim(preg_replace('/\s+/', ' ', $clean_name));

        return array(
            'resident_only'   => $resident_only,
            'display_message' => $display_message,
            'clean_name'      => $clean_name,
        );
    }

    /**
     * Heuristic: does the name suggest a closure/restriction?
     * Used to apply default message when no %% markers present.
     */
    private static function is_closure_name($name) {
        $lower = strtolower($name);
        $indicators = array('full', 'closed', 'private', 'event', 'reserved');
        foreach ($indicators as $word) {
            if (strpos($lower, $word) !== false) {
                return true;
            }
        }
        return false;
    }
}
