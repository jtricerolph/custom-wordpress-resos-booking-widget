<?php
if (!defined('ABSPATH')) {
    exit;
}

class RBW_Rate_Limiter {

    /**
     * Rate limits per group (requests per minute).
     */
    private static $limits = array(
        'read'     => 30,
        'write'    => 5,
        'resident' => 10,
    );

    /**
     * Check if the request is within rate limits.
     *
     * @param string $ip    Client IP address.
     * @param string $group Rate limit group: 'read', 'write', or 'resident'.
     * @return bool True if allowed, false if rate limited.
     */
    public static function check($ip, $group = 'read') {
        $limit = self::$limits[$group] ?? 30;
        $key = 'rbw_rate_' . md5($ip) . '_' . $group;

        $current = get_transient($key);

        if ($current === false) {
            // First request in this window
            set_transient($key, 1, 60);
            return true;
        }

        if ($current >= $limit) {
            return false;
        }

        // Increment counter
        set_transient($key, $current + 1, 60);
        return true;
    }

    /**
     * Get the client IP address.
     */
    public static function get_client_ip() {
        $headers = array(
            'HTTP_CF_CONNECTING_IP', // Cloudflare
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_REAL_IP',
            'REMOTE_ADDR',
        );

        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                $ip = $_SERVER[$header];
                // X-Forwarded-For may contain multiple IPs
                if (strpos($ip, ',') !== false) {
                    $ip = trim(explode(',', $ip)[0]);
                }
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }

        return '0.0.0.0';
    }
}
