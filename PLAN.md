# Custom Restaurant Booking Widget - Implementation Plan

## Context

The current resOS booking widget on hotelnumberfour.com/restaurant is a basic iframe that doesn't support URL parameter pre-population, hotel resident integration, or custom closeout messaging. This project creates a **self-sufficient WordPress plugin** (`restaurant-booking-widget`) with a React frontend that replaces the resOS widget. All API calls are proxied server-side (protecting API keys and guest PII). The widget adds resident-aware booking with multi-day stay planning, duplicate detection, and closeout messaging driven by resOS's own naming conventions.

**Key decisions:**
- WordPress plugin, fully self-contained (NO dependency on BMA, newbook-api-cache, or any other plugins)
- Direct API calls to resOS + NewBook from the plugin's own PHP backend
- No caching layer - single-date/booking lookups are fast enough
- Progressive reveal single-page flow (date → covers → times → details → confirm)
- Resident links use `bookings_get` with booking ID for instant verification
- Resident flow shows multi-day stay planner (all nights at once)
- Closeout markers in resOS names: `##RESIDENTONLY` + `%%message%%`
- Duplicate booking detection by email/phone, no PII exposed to frontend
- NewBook custom field write-back for "no table needed" status

---

## Architecture

```
[Hotel Website - WordPress/Divi]
  |-- [restaurant_booking] shortcode on /restaurant/ page
  |     |-- React Widget (Vite-built, dist/ committed)
  |           |-- Calls /wp-json/rbw/v1/* only
  |           |-- ZERO direct API calls (all proxied, PII stays server-side)
  |
  |-- restaurant-booking-widget.php (SELF-CONTAINED plugin)
        |-- class-rbw-rest-controller.php    (public REST endpoints, rate-limited)
        |-- class-rbw-resos-client.php       (direct resOS API calls)
        |-- class-rbw-newbook-client.php     (direct NewBook API calls)
        |-- class-rbw-closeout-parser.php    (## and %% marker parsing)
        |-- class-rbw-duplicate-checker.php  (email/phone dupe detection via resOS)
        |-- class-rbw-rate-limiter.php       (IP-based throttling)
        |-- class-rbw-admin.php              (settings page)
```

---

## Two Distinct Booking Flows

### Flow A: Regular Guest (public, no link)
Single page, progressive reveal. Each section appears as the previous one is completed.

```
[Date Calendar] ← pick a date
      ↓ reveals
[Party Size: 1-12+] ← "Larger party? Call us"
      ↓ reveals
[Service Period Tabs: Lunch | Dinner]
  [Time Slot Grid] ← pick a time
  [ClosedMessage if unavailable] ← parsed from closeout markers
      ↓ reveals
[Guest Details: name, email, phone, dietary, notes]
  [Resident detection — TBD Phase 3]
      ↓ reveals
[Summary + Turnstile + Confirm]
  [Duplicate warning if email/phone matches existing booking]
  [Success screen]
```

### Flow B: Verified Resident (via personalised link)
Multi-day stay planner. Since we know their stay dates and guest details, show all nights at once.

```
[Welcome Banner: "Welcome John, Room 4 | 3 nights: Feb 12-14"]

[Stay Planner Grid - one row per night]
  Feb 12 (Thu) | [Lunch slots] [Dinner slots] [No table needed ✓]
  Feb 13 (Fri) | [Lunch slots] [Dinner slots] [No table needed ✓]
  Feb 14 (Sat) | [Lunch slots] [Dinner slots] [No table needed ✓]

[Dietary requirements + special requests] ← once, applies to all
[Summary of all selected bookings + Confirm All]
[Success: "3 bookings confirmed"]
```

Each night row shows available time slots inline. Guest taps a time to select it, or ticks "No table needed" to mark that night as handled. Bookings are created in batch on confirm.

---

## APIs Used

### ResOS API
Auth: `Basic base64(api_key + ':')`

| Endpoint | Method | Purpose |
|---|---|---|
| `/v1/bookingFlow/times?date=&people=&onlyBookableOnline=` | GET | Available time slots |
| `/v1/openingHours?showDeleted=false&onlySpecial=false` | GET | Service periods + special events |
| `/v1/customFields` | GET | Custom field definitions |
| `/v1/bookings` | POST | Create booking |
| `/v1/bookings?fromDateTime=&toDateTime=` | GET | Fetch bookings (duplicate check) |

### NewBook API
Auth: `Basic base64(username + ':' + password)`, `api_key` + `region` in body

| Endpoint | Method | Purpose |
|---|---|---|
| `/rest/bookings_get` | POST | Get single booking by ID (resident verification) |
| `/rest/bookings_list` (list_type: staying) | POST | Get staying guests for a date (Phase 3 TBD) |
| `/rest/instance_custom_fields_set` (TBC) | POST | Write "no table needed" custom field |

`bookings_get` returns: booking dates (`period_from`/`period_to`), guest details (`guests[0].firstname`, `lastname`, `contact_details[]`), room (`site_name`), `booking_id`, guest IDs.

---

## Closeout Marker System

Restaurant staff name closeouts/special events in resOS normally. The widget parses the `name` field:

**`##RESIDENTONLY`** — access control
- Non-residents blocked; verified residents call `bookingFlow/times` with `onlyBookableOnline: false` to bypass

**`%%message%%`** — guest-facing text between `%%` delimiters
- If no `%%` markers: default "Please call [phone] to enquire"

**Examples of closeout names set in resOS:**
| resOS Closeout Name | Non-Resident Sees | Resident Sees |
|---|---|---|
| `Dinner Full ##RESIDENTONLY %%Dinner reserved for hotel guests. Call 01451 830297%%` | "Dinner reserved for hotel guests. Call 01451 830297" | Available time slots |
| `%%Limited tables: call 01451 830297 to book%%` | "Limited tables: call 01451 830297 to book" | Same (blocks everyone) |
| `Private Event` | "Fully booked. Call [phone]" (default) | Same (no `##RESIDENTONLY`) |

---

## Resident Verification (Flow B - via Direct Link)

URL only needs `bid` (booking ID) + `gid` (guest ID) for security.

**URL format** (from NewBook contact template merge fields):
```
https://hotelnumberfour.com/restaurant/?bid={booking_id}&gid={guest_id}
```

**Backend flow:**
1. Receive `bid` + `gid`
2. Call NewBook `bookings_get` with `booking_id = bid`
3. Verify `gid` matches a guest ID on that booking
4. Extract: guest name, stay dates, room, contact details
5. Return to frontend: `{ verified, guest_name, room, check_in, check_out, nights[], booking_id }`
6. Frontend enters Flow B (multi-day stay planner)

Additional URL params for alternative verification:
- `surname`, `email`, `phone` — alternative second factor if `gid` not available
- `people` — pre-set party size

---

## Duplicate Booking Detection

Before creating any booking, backend checks for existing bookings on that date.

**Server-side only (no PII to frontend):**
1. Frontend submits with guest email and/or phone
2. Backend calls `GET /v1/bookings?fromDateTime={date}T00:00:00&toDateTime={date}T23:59:59`
3. Compares normalised email/phone against existing bookings' `guest.email`/`guest.phone`
4. If match: returns `{ duplicate: true, existing_time: "19:00", existing_people: 4 }`
5. Frontend: "You already have a booking at 7:00 PM for 4 guests."
6. Options: "This is correct" (cancel new) or "I need an additional booking" (proceed)

Phone normalised to last 9 digits for comparison.

---

## "No Table Needed" Feature

In the resident multi-day view (Flow B), guests can mark nights where they don't want a restaurant table.

- Backend calls NewBook API to update a custom field on the booking
- Custom field in NewBook: e.g., "Restaurant Status"
- Stores per-date status: booked / not_required
- Allows downstream systems to track which guests have addressed restaurant needs

---

## Phase 1: MVP — Core Booking Widget (Flow A)

### Backend (PHP)

**`restaurant-booking-widget.php`** — Plugin bootstrap
- Shortcode `[restaurant_booking]`, autoloader, script enqueue
- `wp_localize_script()` passes: REST URL, nonce, phone number, turnstile key

**`includes/class-rbw-resos-client.php`** — Direct resOS API client
- Own key: `get_option('rbw_resos_api_key')`
- Methods: `get_available_times()`, `get_opening_hours()`, `get_custom_fields()`, `get_bookings_for_date()`, `create_booking()`
- Phone formatting: strip leading 0, add +44 prefix

**`includes/class-rbw-rest-controller.php`** — Public REST endpoints
- `GET /rbw/v1/opening-hours?date=` — periods + special events
- `POST /rbw/v1/available-times` — time slots
- `GET /rbw/v1/dietary-choices` — dietary options from custom fields
- `POST /rbw/v1/create-booking` — submit booking (Turnstile + duplicate check)
- All rate-limited per IP

**`includes/class-rbw-closeout-parser.php`** — `##` and `%%` marker parsing

**`includes/class-rbw-duplicate-checker.php`** — Email/phone dupe check

**`includes/class-rbw-rate-limiter.php`** — WP transient-based IP throttling

**`includes/class-rbw-admin.php`** — Settings page
- ResOS API key + test connection
- NewBook credentials + test connection
- Restaurant phone, Turnstile keys, default closeout message

### Frontend (React + TypeScript + Vite)

Progressive reveal single-page:
- `App.tsx` — state, progressive reveal logic
- `DatePicker.tsx` — calendar grid (next 30 days)
- `PartySize.tsx` — covers selector
- `ServicePeriods.tsx` — period tabs
- `TimeSlots.tsx` — time button grid
- `ClosedMessage.tsx` — closeout/full messaging
- `GuestForm.tsx` — name, email, phone, dietary, notes
- `DuplicateWarning.tsx` — "you already have a booking" prompt
- `BookingConfirmation.tsx` — success screen
- `useBookingApi.ts`, `useBookingFlow.ts` — hooks
- `theme.ts`, `validation.ts` — utils

Build: `npm run build` → `frontend/dist/` (committed).

---

## Phase 2: Resident Links + Multi-Day Stay Planner (Flow B)

### Backend:
**`includes/class-rbw-newbook-client.php`** — Direct NewBook API client
- `get_booking($booking_id)` — `bookings_get`
- `get_staying_guests($date)` — `bookings_list` (staying)
- `update_custom_field($booking_id, $field, $value)` — restaurant status write-back

**`includes/class-rbw-resident-lookup.php`** — Verification logic
- `verify_from_link($bid, $gid, ...)` — `bookings_get` + verify second factor
- Returns: `{ verified, guest_name, room, check_in, check_out, nights[], booking_id }`

**New endpoints:**
- `POST /rbw/v1/verify-resident`
- `POST /rbw/v1/available-times-multi` — batch time slots for stay planner
- `POST /rbw/v1/create-bookings-batch` — batch create + no-table flags

### Frontend:
- `useUrlParams.ts` — parse URL params, auto-verify
- `StayPlanner.tsx` — multi-day grid (one row per night)
- `ResidentBanner.tsx` — welcome header with room/dates
- `BookingBatchConfirmation.tsx` — multi-booking summary

---

## Phase 3: Non-Link Resident Detection — TBD

Approach for detecting hotel residents who book via the regular flow (without using a personalised link) is to be determined. Options under consideration:
- Surname check against NewBook staying list
- Optional "hotel booking reference" field in guest form
- Combination approach
- Or rely solely on link-based verification (Phase 2) with staff manual matching via Chrome extension as fallback

**This phase will be designed in a separate planning session.**

---

## Phase 4: Closeout Messaging + Polish

- `ClosedMessage.tsx` enhanced: parsed `%%message%%`, default fallbacks
- `##RESIDENTONLY` hint for non-residents
- Loading skeletons, error states, retry
- Animations, accessibility, mobile-first responsive

---

## Project Structure

```
restaurant-booking-widget/
|-- restaurant-booking-widget.php
|-- includes/
|   |-- class-rbw-rest-controller.php
|   |-- class-rbw-resos-client.php
|   |-- class-rbw-newbook-client.php
|   |-- class-rbw-resident-lookup.php
|   |-- class-rbw-duplicate-checker.php
|   |-- class-rbw-closeout-parser.php
|   |-- class-rbw-rate-limiter.php
|   |-- class-rbw-admin.php
|-- frontend/
|   |-- package.json
|   |-- vite.config.ts
|   |-- tsconfig.json
|   |-- src/
|   |   |-- main.tsx
|   |   |-- App.tsx
|   |   |-- components/
|   |   |   |-- DatePicker.tsx
|   |   |   |-- PartySize.tsx
|   |   |   |-- ServicePeriods.tsx
|   |   |   |-- TimeSlots.tsx
|   |   |   |-- GuestForm.tsx
|   |   |   |-- ClosedMessage.tsx
|   |   |   |-- DuplicateWarning.tsx
|   |   |   |-- ResidentBanner.tsx
|   |   |   |-- ResidentPrompt.tsx
|   |   |   |-- StayPlanner.tsx
|   |   |   |-- BookingConfirmation.tsx
|   |   |   |-- BookingBatchConfirmation.tsx
|   |   |-- hooks/
|   |   |   |-- useBookingApi.ts
|   |   |   |-- useBookingFlow.ts
|   |   |   |-- useUrlParams.ts
|   |   |   |-- useResidentCheck.ts
|   |   |-- utils/
|   |   |   |-- theme.ts
|   |   |   |-- validation.ts
|   |-- dist/
|-- readme.txt
```
