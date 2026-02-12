# Custom Restaurant Booking Widget - Implementation Plan

## Context

The current resOS booking widget on hotelnumberfour.com/restaurant is a basic iframe that doesn't support URL parameter pre-population, hotel resident integration, or custom closeout messaging. This project creates a **self-sufficient WordPress plugin** (`restaurant-booking-widget`) with a React frontend that replaces the resOS widget. All API calls are proxied server-side (protecting API keys and guest PII). The widget adds resident-aware booking with multi-day stay planning, duplicate detection, and closeout messaging driven by resOS's own naming conventions.

**Key decisions:**
- WordPress plugin, fully self-contained (NO dependency on BMA, newbook-api-cache, or any other plugins)
- Direct API calls to resOS + NewBook from the plugin's own PHP backend
- No caching layer - single-date/booking lookups are fast enough
- Progressive reveal single-page flow (date -> covers -> times -> details -> confirm)
- Resident links use `bookings_get` with booking ID for instant verification
- Resident flow shows multi-day stay planner (all nights at once)
- Closeout markers in resOS names: `##RESIDENTONLY` + `%%message%%`
- Duplicate booking detection by email/phone, no PII exposed to frontend
- NewBook custom field write-back for "no table needed" status
- Staying list prefetched on date selection for instant resident matching

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
        |-- class-rbw-resident-matcher.php   (staying list matching + group detection)
        |-- class-rbw-rate-limiter.php       (IP-based throttling)
        |-- class-rbw-admin.php              (settings page)
```

---

## Three Entry Points Into Booking

### Flow A: Regular Guest (public, no link)
Single page, progressive reveal. Each section appears as the previous one is completed.

```
[Date Calendar] <- pick a date
      | (background: prefetch staying list for this date, cache in WP transient)
      v reveals
[Party Size: 1-12+] <- "Larger party? Call us"
      v reveals
[Service Period Tabs: Lunch | Dinner]
  [Time Slot Grid] <- pick a time
  [ClosedMessage if unavailable] <- parsed from closeout markers
      v reveals
[Guest Details: name*, email*, phone (optional), dietary, notes]
  ["Are you staying at the hotel?" Yes / No]
      v if Yes: instant match against cached staying list
  [Resident detection result — see Phase 3]
      v reveals
[Summary + Turnstile + Confirm]
  [Duplicate warning if email/phone matches existing booking]
      v
[Confirmation Page]
  [Booking summary]
  [If verified resident + multi-night: Stay planner for remaining nights]
```

### Flow B: Verified Resident (via personalised link)
Multi-day stay planner. Since we know their stay dates and guest details, show all nights at once.

```
[Welcome Banner: "Welcome John, Room 4 | 3 nights: Feb 12-14"]

[Stay Planner Grid - one row per night]
  Feb 12 (Thu) | [Lunch slots] [Dinner slots] [No table needed]
  Feb 13 (Fri) | [Lunch slots] [Dinner slots] [No table needed]
  Feb 14 (Sat) | [Lunch slots] [Dinner slots] [No table needed]

[Dietary requirements + special requests] <- once, applies to all
[Summary of all selected bookings + Confirm All]
[Success: "3 bookings confirmed"]
```

Each night row shows available time slots inline. Guest taps a time to select it, or ticks "No table needed" to mark that night as handled. Bookings are created in batch on confirm.

### Flow A -> B Transition (matched resident during regular flow)
When a regular guest is identified as a hotel resident during Flow A (Phase 3), after their first booking confirms, the confirmation page includes a stay planner for remaining nights.

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
| `/v1/bookings?fromDateTime=&toDateTime=` | GET | Fetch bookings (duplicate check + group table check) |

**Pagination:** resOS responses are paginated at 100 results. The `GET /v1/bookings` endpoint (duplicate check) may exceed 100 on busy days and needs pagination handling. Other endpoints (`openingHours`, `customFields`, `bookingFlow/times`) are unlikely to exceed 100.

### NewBook API
Auth: `Basic base64(username + ':' + password)`, `api_key` + `region` in body

| Endpoint | Method | Purpose |
|---|---|---|
| `/rest/bookings_get` | POST | Get single booking by ID (resident verification via link) |
| `/rest/bookings_list` (list_type: staying) | POST | Get staying guests for a date (resident matching) |
| `/rest/instance_custom_fields_set` (TBC) | POST | Write "no table needed" custom field |

`bookings_get` returns: booking dates (`period_from`/`period_to`), guest details (`guests[0].firstname`, `lastname`, `contact_details[]`), room (`site_name`), `booking_id`, `bookings_group_id`, guest IDs.

`bookings_list` (staying) returns: all bookings with guests staying on a given date, including `booking_id`, `bookings_group_id`, `booking_reference_id`, guest details, `travel_agent_name`.

---

## Closeout Marker System

Restaurant staff name closeouts/special events in resOS normally. The widget parses the `name` field:

**`##RESIDENTONLY`** -- access control
- Non-residents blocked; verified residents call `bookingFlow/times` with `onlyBookableOnline: false` to bypass

**`%%message%%`** -- guest-facing text between `%%` delimiters
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
- `surname`, `email`, `phone` -- alternative second factor if `gid` not available
- `people` -- pre-set party size

---

## Resident Matching (Flow A - during regular booking)

### Staying List Prefetch

When a guest selects a date in Flow A, the backend prefetches the NewBook staying list for that date and caches it in a WP transient (~5 min TTL). This happens in the background so by the time the guest reaches the details form, the data is ready for instant matching. All staying data remains server-side -- no PII is ever sent to the frontend.

### Matching Flow

After the guest fills in name, email, and optionally phone, they see "Are you staying at the hotel?" If they click Yes, the backend matches their details against the cached staying list.

**Match endpoint:** `POST /rbw/v1/check-resident`
- Input: `{ date, name, email, phone }`
- Backend: compare against cached staying list
- Output: `{ match_tier, booking_id, booking_reference_id, stay_dates, room, group_info, phone_on_file }` (no guest PII from NewBook returned to frontend)

### Match Tiers

**Tier 1: Auto-match (email + last name)**
Email matches (case-insensitive) AND last name matches (name field split by last space, last token compared case-insensitive) a staying guest.

Result:
```
"It looks like you're staying at the hotel! Booking #12345"
[Booking Reference: 12345] <- prefilled, editable

If multi-night stay + time already selected:
  "Would you like a similar time on other nights of your stay?"
  [ ] Feb 13 (Fri)  Dinner 7:00 PM  x2 guests
  [ ] Feb 14 (Sat)  Dinner 7:00 PM  x2 guests
```

**Tier 2: Partial match -- phone verification (name matches, email doesn't)**
Last name matches a staying guest but email doesn't match (e.g., booking.com forwarded email, partner booked). The matched NewBook booking has a phone number on file.

Result:
```
"Not sure about your booking number? Add your mobile and we can
 try to verify and find it for you"
[Mobile: ________]
    v on submit, normalised phone matches
"Found it! Booking #12345"
[Booking Reference: 12345] <- prefilled
```

Phone normalised to last 9 digits for comparison (same pattern as Chrome extension).

Note: phone verification prompt only shown when the matched NewBook booking actually has a phone number to compare against. Backend returns `{ phone_on_file: true }` (boolean, not the actual number).

**Tier 3: No match -- manual entry**
No name/email/phone combination matches any staying guest.

Result:
```
[Booking Reference: ________]
```

Guest enters their reference manually. Backend checks against both `booking_id` AND `booking_reference_id` on all staying bookings for the date. This handles OTA references (e.g., Booking.com confirmation numbers).

**If OTA reference matches:**
```
Modal: "We found your booking from {travel_agent_name}. Our reference
for your booking is {booking_id}. We've updated it for you."
[Booking Reference: 12345] <- updated to internal ID
```

**If no reference matches:**
```
"We couldn't verify your stay. Please check your booking confirmation
email for your reference number, or ask reception."
[Continue booking] <- proceeds as unverified hotel guest
```

Even unverified: resOS booking gets Hotel Guest = Yes + whatever reference they entered. Reception can clean up via Chrome extension.

### Matching Logic Details

**Name parsing:**
- Guest enters single name field (e.g., "John Smith")
- Split by last space: first = "John", last = "Smith"
- Compare last name case-insensitive against NewBook `guests[].lastname`
- First name used as tiebreaker if multiple last name matches

**Email comparison:**
- Both lowercased, exact match

**Phone normalisation:**
- Strip all non-digits
- Take last 9 digits
- Compare (handles +44, 0044, 07xxx variations)

---

## Covers vs Room Occupancy

When a resident is matched (any tier), the backend knows their room occupancy (number of guests on the NewBook booking). If the selected party size exceeds their room occupancy:

```
"You've selected {covers} guests, but your room booking is for {occupancy}.
 Will others be joining you?"

  ( ) Non-residents joining us
      -> adds booking note: "Being joined by non-residents"

  ( ) Other hotel guests joining our table
      -> "Let us know what name they booked under so we can note
          they're joining your table"
      [Name(s): ________]
      -> adds booking note: "Joined by hotel guests: {names}"
```

---

## Group Booking Detection

When a matched resident's NewBook booking has a `bookings_group_id`, additional logic runs. Group members are identified from the already-cached staying list (filter by same `bookings_group_id` -- no extra API calls).

### Checking for Existing Group Table Bookings

The resOS bookings for the date (already fetched for duplicate checking) are checked for group members:

1. Get all NewBook booking IDs in the group from cached staying list
2. Check each resOS booking's **Booking# custom field** for matches against those IDs
3. This tells us which group members already have tables, and how many covers they booked

### Group Scenarios

**No existing group table bookings:**

*Covers > room occupancy:*
> "You're part of a group. Looks like you're booking for the group -- should we note this booking is for your group?"
> [Yes, this is for our group] -> booking note: "Group booking"
> [No, just for us] -> proceed normally

*Covers = room occupancy:*
> "You're part of a group but have only booked for {covers}. Are the other guests booking separately, or would you like to dine together?"
> [They'll book separately] -> proceed normally
> [We'd like to dine together] -> adjust covers prompt

**Other group members already have tables:**

*Their existing booking has more covers than their room occupancy (someone booked for the whole group):*
> "There looks like there might be a booking for your group already -- perhaps someone else has already booked. We can't show details of that booking. You're welcome to continue booking, but feel free to check with the other group members or give us a call if you need assistance on {phone}."
> [Continue booking anyway] | [Cancel]

*Their existing bookings only match their own room occupancy (individual bookings):*
> "It looks like other members of your group already have bookings. If you're dining separately, feel free to continue. If you'd like us to sort a table for the whole group, it would be easiest to give us a call on {phone}."
> [Continue booking] | [Cancel]

### Group Handling Output

The widget does **not** update the GROUP/EXCLUDE custom field or modify any existing bookings. All group context is added as **booking notes/comments** on the newly created resOS booking. Staff review these notes and handle group linking manually via the Chrome extension.

Example booking notes:
- "Guest confirmed booking is for their group"
- "Guest says other group members booking separately"
- "Being joined by non-residents"
- "Joined by hotel guests: Mr & Mrs Jones"
- "Part of group - other members may already have tables booked"

### Privacy

Group detection never reveals other guests' names, booking details, or table times. Messages are intentionally vague ("someone in your group", "other members") with phone fallback for complex coordination.

---

## Post-Booking Stay Planner Transition

After a verified resident's first booking confirms via Flow A, the confirmation page shows:

```
+-- Booking Confirmed ---------------------------------+
|  Dinner, Feb 12 at 7:00 PM for 2 guests             |
|  Booking #12345                                      |
+------------------------------------------------------+

+-- Your Stay ------------------------------------------+
|  Feb 12 (Thu) | Dinner 7:00 PM  confirmed             |
|  Feb 13 (Fri) | [Lunch slots] [Dinner slots] [No table needed] |
|  Feb 14 (Sat) | [Lunch slots] [Dinner slots] [No table needed] |
|                                                        |
|  [Confirm remaining nights]                            |
+--------------------------------------------------------+
```

The just-booked night shows as confirmed. Remaining nights show available time slots or "No table needed" checkbox. Guest can book additional nights or mark them as not needed, all in one action.

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

In the resident multi-day view (Flow B or post-booking stay planner), guests can mark nights where they don't want a restaurant table.

- Backend calls NewBook API to update a custom field on the booking
- Custom field in NewBook: e.g., "Restaurant Status"
- Stores per-date status: booked / not_required
- Allows downstream systems to track which guests have addressed restaurant needs

---

## resOS Custom Fields

### API Behaviour

Custom fields on resOS bookings are a **JSON array** (`customFields`). On update (PUT), this is a **full overwrite** -- any fields not included in the array are deleted. For new bookings (POST), we supply the initial array. Each field object requires `_id` (the field definition ID from resOS) and the value in a type-specific format.

### Field Type Formats

**Text fields:**
```json
{ "_id": "field-def-id", "name": "Booking #", "value": "12345" }
```

**Single-select (radio/dropdown) -- needs BOTH choice ID and display name:**
```json
{ "_id": "field-def-id", "name": "Hotel Guest", "value": "choice-uuid", "multipleChoiceValueName": "Yes" }
```
The `value` is the `_id` of the selected choice from `multipleChoiceSelections`. The `multipleChoiceValueName` is needed for the resOS UI to display correctly.

**Multi-select (checkbox) -- array of objects, each with _id, name, and value:true:**
```json
{ "_id": "field-def-id", "name": "Dietary Requirements", "value": [
  { "_id": "choice-uuid-1", "name": "Gluten Free", "value": true },
  { "_id": "choice-uuid-2", "name": "Vegan", "value": true }
]}
```

### Choice ID Resolution

To set a single-select field (e.g., Hotel Guest = "Yes"):
1. Fetch `GET /v1/customFields` to get all field definitions
2. Find the field by its `_id` (from settings)
3. Search `field.multipleChoiceSelections` for the choice with matching name
4. Use that choice's `_id` as the `value`, and its `name` as `multipleChoiceValueName`

### Field Mapping in Settings

The admin settings page includes a "Custom Field Mapping" section:

1. **"Load Fields from resOS"** button -- calls `GET /v1/customFields`, populates dropdowns
2. Each dropdown shows: `{field.name} ({field.type})` with value = `field._id`
3. User maps:
   - **Hotel Guest field** -- which resOS field (radio/dropdown type expected)
   - **Booking # field** -- which resOS field (text type expected)
   - **Dietary field** -- which resOS field (checkbox type expected, for guest form)

Field IDs stored as WP options: `rbw_field_hotel_guest`, `rbw_field_booking_ref`, `rbw_field_dietary`.

On plugin init (or first use), auto-detect is attempted by name pattern matching:
- Hotel Guest: field name contains "hotel" AND "guest" (case-insensitive)
- Booking #: field name contains "booking" AND "#"
- Dietary: field name contains "dietary" (note: resOS has a **leading space** in `" Dietary Requirements"` -- trim before matching)

Auto-detected values are pre-filled in settings but user can override.

### Choice ID Caching

When fields are loaded/mapped, the specific choice IDs needed are also resolved and cached:
- Hotel Guest "Yes" choice ID -- found by matching choice name "Yes" in `multipleChoiceSelections`
- Stored alongside the field ID in WP options: `rbw_field_hotel_guest_yes_choice`

This avoids fetching field definitions on every booking creation.

### Fields Written on Booking Creation

| Custom Field | Type | Value | Notes |
|---|---|---|---|
| Hotel Guest | radio/dropdown | Choice ID for "Yes" + `multipleChoiceValueName: "Yes"` | Only when guest identified as hotel resident |
| Booking # | text | NewBook booking_id as string | Only when resident verified/declared |
| Dietary | checkbox | Array of selected choice objects | From guest form checkboxes |

Additional context goes in the booking `notes` field (group info, joined-by names, covers mismatch, etc.).

### What the widget does NOT write:
- GROUP/EXCLUDE field -- staff handle group linking via Chrome extension after reviewing booking notes
- No modifications to existing resOS bookings (other guests' tables, covers, etc.)
- No need for full-overwrite logic since we only CREATE new bookings, never update existing ones' custom fields

---

## URL Parameter Pre-population

All widget form fields accept pre-population via URL GET parameters. This supports links from emails, CRM, or other systems that want to deep-link into the booking flow with values pre-filled.

| URL Parameter | Pre-fills | Example |
|---|---|---|
| `date` | Calendar date | `?date=2026-02-14` |
| `people` | Party size | `?people=4` |
| `name` | Guest name field | `?name=John+Smith` |
| `email` | Guest email field | `?email=john@example.com` |
| `phone` | Guest phone field | `?phone=07700900123` |
| `bid` | Resident booking ID (triggers Flow B) | `?bid=12345&gid=67890` |
| `gid` | Resident guest ID (second factor for Flow B) | (used with `bid`) |

When `date` and/or `people` are provided, the widget auto-advances the progressive reveal to the appropriate step. When `bid` + `gid` are provided, Flow B is triggered immediately.

---

## Booking Creation Payload

When creating a resOS booking, include these notification fields so resOS sends the guest a confirmation email (which includes a manage/cancel link):

```json
{
  "date": "2026-02-14",
  "time": "19:00",
  "people": 2,
  "guest": {
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "+447700900123",
    "notificationEmail": true
  },
  "sendNotification": true,
  "source": "website",
  "notes": "...",
  "customFields": { ... }
}
```

Key fields:
- `sendNotification: true` -- tells resOS to send the confirmation email
- `guest.notificationEmail: true` -- confirms the guest wants email notifications
- The confirmation email from resOS includes a link for the guest to manage/cancel their booking

---

## Confirmation Screen

After a successful booking, the confirmation screen shows:

```
+-- Booking Confirmed ------------------------------------+
|  Dinner, Friday 14 February at 7:00 PM for 2 guests    |
|  Booking reference: #12345                              |
|                                                         |
|  A confirmation email has been sent to john@example.com |
|                                                         |
|  To modify or cancel your booking, use the link in      |
|  your confirmation email, or call us on 01451 830297.   |
+---------------------------------------------------------+
```

No in-widget cancellation/modification -- handled entirely via the resOS confirmation email link or by phone.

---

## Error Handling

Different error states depending on when the failure occurs:

### Pre-flow failure (opening hours / initial data load fails)
```
"We're experiencing technical issues with our booking system.
 Please call us on {phone} to make a reservation."
```
No retry button -- if the initial API call fails, the system may be down.

### Mid-flow failure (time slot load, booking submission fails)
```
"Something went wrong. Please try again, or call us on
 {phone} and we'll be happy to assist."
[Try again]
```
Retry button re-attempts the failed API call. If it fails again, same message persists with phone fallback.

### NewBook failure (resident verification / staying list)
NewBook API being down should NOT block the booking flow. The widget degrades gracefully:
- Staying list prefetch fails silently -- "Are you staying?" still appears but matching won't work
- Resident link verification fails: "We couldn't verify your booking link. You can continue booking as a regular guest."
- Falls back to Flow A with manual booking reference entry if guest says they're staying

### Turnstile failure
```
"Please complete the verification to submit your booking."
```
Turnstile widget re-renders. If persistent failure, phone fallback message.

---

## Opening Hours & Time Slot Filtering

The `bookingFlow/times` endpoint returns available times **per opening hour period**. The `openingHourId` parameter filters which period to fetch times for.

**Flow:**
1. `GET /rbw/v1/opening-hours?date=` returns all periods for the date (each with `id`, `name`, `from`, `to`, special event info)
2. Closeout parser checks each period's name for `##RESIDENTONLY` and `%%message%%` markers
3. Frontend renders accordion with one section per period
4. When a period accordion is expanded, `POST /rbw/v1/available-times` is called with `openingHourId` for that period
5. Times returned are displayed as button grid within the accordion section

This means time slots are lazy-loaded per period (not all at once), keeping API calls minimal. The default-expanded period (latest with availability, typically Dinner) loads its times immediately.

---

## Phase 1: MVP -- Core Booking Widget (Flow A basics)

### Backend (PHP)

**`restaurant-booking-widget.php`** -- Plugin bootstrap
- Shortcode `[restaurant_booking]`, autoloader, script enqueue
- `wp_localize_script()` passes: REST URL, nonce, phone number, turnstile key, max party size, max booking window days, colour preset

**`includes/class-rbw-resos-client.php`** -- Direct resOS API client
- Own key: `get_option('rbw_resos_api_key')`
- Methods: `get_available_times()`, `get_opening_hours()`, `get_custom_fields()`, `get_bookings_for_date()`, `create_booking()`
- Phone formatting: strip leading 0, add +44 prefix

**`includes/class-rbw-rest-controller.php`** -- Public REST endpoints
- `GET /rbw/v1/opening-hours?date=` -- periods + special events for date
- `POST /rbw/v1/available-times` -- time slots (date, people, openingHourId)
- `GET /rbw/v1/dietary-choices` -- dietary options from custom fields
- `POST /rbw/v1/create-booking` -- submit booking (Turnstile + duplicate check)
- All rate-limited per IP

**`includes/class-rbw-closeout-parser.php`** -- `##` and `%%` marker parsing

**`includes/class-rbw-duplicate-checker.php`** -- Email/phone dupe check

**`includes/class-rbw-rate-limiter.php`** -- WP transient-based IP throttling

**`includes/class-rbw-admin.php`** -- Settings page (Settings > Booking Widget)
- **API Credentials:**
  - ResOS API key + test connection
  - NewBook credentials (username, password, API key, region) + test connection
- **General:**
  - Restaurant phone number (used in closeout messages, error states, "call us" fallbacks)
  - Turnstile site key + secret
  - Default closeout message template
- **Widget:**
  - Max party size (default 12) -- last button becomes `[{max}+]` with "please call" message
  - Max booking window in days (default 180) -- how far ahead the calendar allows
  - Colour preset: Light / Dark / Warm / Cold (4 clean accent sets, default Warm)
- **Custom Field Mapping:**
  - "Load Fields from resOS" button -- fetches `GET /v1/customFields`, populates dropdowns
  - Hotel Guest field mapping (dropdown, auto-detects by name pattern)
  - Booking # field mapping (dropdown, auto-detects by name pattern)
  - Dietary field mapping (dropdown, auto-detects by name pattern)
  - Choice IDs auto-resolved and cached (e.g., Hotel Guest "Yes" choice ID)

### Frontend (React + TypeScript + Vite)

Progressive reveal single-page widget:

**Components:**
- `App.tsx` -- main state, progressive reveal logic
- `DatePicker.tsx` -- calendar grid (next 30 days)
- `PartySize.tsx` -- covers selector (1-12, "Larger? Call us")
- `ServicePeriods.tsx` -- tab bar per service period
- `TimeSlots.tsx` -- time button grid within a period
- `ClosedMessage.tsx` -- closeout/full messaging with parsed `%%text%%`
- `GuestForm.tsx` -- name, email, phone, dietary checkboxes, notes
- `DuplicateWarning.tsx` -- "you already have a booking" prompt
- `BookingConfirmation.tsx` -- success screen

**Hooks:**
- `useBookingApi.ts` -- all `/rbw/v1/*` calls
- `useBookingFlow.ts` -- state machine (which sections revealed, current selections)

**Utils:**
- `theme.ts` -- hotel brand (Raleway font, warm tones)
- `validation.ts` -- phone/email validation, phone formatting

Build: `npm run build` -> `frontend/dist/` (committed). Shortcode enqueues from `dist/`.

---

## Phase 2: Resident Links + Multi-Day Stay Planner (Flow B)

### Backend additions:

**`includes/class-rbw-newbook-client.php`** -- Direct NewBook API client
- Own credentials: `get_option('rbw_newbook_*')`
- `get_booking($booking_id)` -- calls `bookings_get`, returns full booking data
- `get_staying_guests($date)` -- calls `bookings_list` (list_type: staying)
- `update_custom_field($booking_id, $field, $value)` -- write restaurant status

**`includes/class-rbw-resident-lookup.php`** -- Link verification logic
- `verify_from_link($bid, $gid, $surname, $email, $phone)` -- calls `bookings_get`, verifies second factor
- Returns: `{ verified, guest_name, room, check_in, check_out, nights[], booking_id }`

**New REST endpoints:**
- `POST /rbw/v1/verify-resident` -- verify URL params, return stay info
- `POST /rbw/v1/available-times-multi` -- time slots for multiple dates at once
- `POST /rbw/v1/create-bookings-batch` -- batch create + no-table flags
- `POST /rbw/v1/mark-no-table` -- mark specific dates as "not required" in NewBook

### Frontend additions:

- `useUrlParams.ts` -- parse URL GET vars on mount, auto-verify if `bid` + `gid` present
- `StayPlanner.tsx` -- multi-day grid (one row per night of stay)
- `ResidentBanner.tsx` -- "Welcome [Name], Room [X] | [N] nights: [dates]"
- `BookingBatchConfirmation.tsx` -- multi-booking summary with Confirm All

---

## Phase 3: Non-Link Resident Detection + Group Handling

### Staying List Prefetch

**Backend:**
- When `GET /rbw/v1/opening-hours?date=` is called (already happens on date selection), the backend also prefetches the NewBook staying list for that date
- Cached in WP transient with ~5 min TTL, keyed by date
- All staying data stays server-side, never returned to frontend at this stage

**New REST endpoint:**
- `POST /rbw/v1/check-resident` -- accepts `{ date, name, email, phone }`, returns match result

### Backend: class-rbw-resident-matcher.php

**`match_guest($date, $name, $email, $phone)`**
1. Get cached staying list for date (or fetch if expired)
2. Parse name: split by last space -> first_name, last_name
3. Run match tiers:
   - Tier 1: email (lowercased) + last_name (case-insensitive) match
   - Tier 2: last_name matches but email doesn't, check if matched booking has phone on file
   - Tier 3: no match
4. Return: `{ match_tier, booking_id, booking_reference_id, check_in, check_out, nights[], room, occupancy, group_id, phone_on_file, group_info }`

**`verify_phone($date, $name, $phone)`**
- Called when guest provides phone after Tier 2 partial match
- Normalise to last 9 digits, compare against matched booking's phone
- Return: `{ verified, booking_id }` or `{ verified: false }`

**`verify_reference($date, $reference)`**
- Called for manual booking# entry (Tier 3)
- Check `$reference` against both `booking_id` AND `booking_reference_id` on all staying bookings
- If OTA match: return `{ verified, booking_id, travel_agent_name }`

**`check_group($date, $booking_id, $group_id, $covers)`**
- Get all staying bookings with same `bookings_group_id`
- Get resOS bookings for date, check Booking# custom field for any group member IDs
- Return: `{ is_group, group_size, group_occupancy_total, existing_tables[] }`
  - `existing_tables[].covers` and `existing_tables[].occupancy` for the group member who booked

### Frontend: HotelGuestSection Component

Appears in GuestForm after name/email/phone fields.

**States:**
1. **Initial:** "Are you staying at the hotel?" [Yes] [No]
2. **Checking:** spinner while matching
3. **Auto-matched (Tier 1):** "It looks like you're staying at the hotel! Booking #{id}" + prefilled ref + multi-night upsell if applicable
4. **Phone prompt (Tier 2):** "Not sure about your booking number? Add your mobile and we can try to verify and find it for you" + phone input
5. **Phone verified:** same as auto-matched
6. **Manual entry (Tier 3):** booking reference field
7. **OTA detected:** modal with travel agent name and internal booking ID
8. **Unverified:** help message + continue option
9. **Covers mismatch:** "You've selected X guests but your booking is for Y" + options
10. **Group detected:** appropriate group message based on scenario

### Frontend: MultiNightUpsell Component

Shown inline when a matched resident has a multi-night stay and a time is already selected:

```
"Would you like a similar time on other nights of your stay?"
[ ] Feb 13 (Fri)  Dinner 7:00 PM  x2 guests
[ ] Feb 14 (Sat)  Dinner 7:00 PM  x2 guests
```

Checked nights get created as additional bookings in the same submit. Unchecked nights can be addressed on the post-booking stay planner.

### Frontend: GroupBookingPrompt Component

Shown when group_id detected:
- Covers mismatch messages
- Existing group table warnings
- Phone number fallback for complex coordination

### Post-Booking Confirmation Enhancement

`BookingConfirmation.tsx` extended: if verified resident with remaining stay nights, show inline `StayPlanner` below the booking summary for remaining nights.

---

## UI/UX Design

### Brand & Theme
- Clean, minimal styling that fits naturally within any WordPress theme
- No heavy branding or opinionated design -- neutral enough to sit on most sites
- CSS-in-JS (inline styles via `theme.ts`) -- no external CSS dependencies, no style conflicts
- 4 colour presets selectable via WP settings:
  - **Warm** (default) -- warm neutral tones (earthy accents)
  - **Light** -- clean light greys and soft accents
  - **Dark** -- dark backgrounds, light text
  - **Cold** -- cool blue/grey tones
- Mobile-first responsive, works within Divi page builder
- Typography inherits from parent theme where possible (font-family: inherit as default)

### Calendar (DatePicker)
- In-page calendar grid (not a popup/dropdown) -- flows naturally with progressive reveal
- Shows current month with day grid (Mo-Su)
- Past dates greyed out, today highlighted
- Arrow buttons (`<` `>`) for month navigation
- **Month jump:** clicking the month/year header (e.g., "February 2026") opens a month picker grid:
  ```
       <  February 2026  >     <- clickable header
                                  v
                            +----------------+
                            | Feb  Mar  Apr  |
                            | May  Jun  Jul  |
                            | Aug  Sep  Oct  |
                            | Nov  Dec  Jan  |
                            +----------------+
  ```
- Month picker limited by max booking window setting (default 180 days)
- Selected date visually highlighted, subtle animation on selection

### Party Size (PartySize)
- Button grid (not dropdown) -- tactile, shows all options at once:
  ```
  How many guests?
  [1] [2] [3] [4] [5] [6] [7] [8] [9] [10] [11] [12+]
  ```
- Max party size configurable via settings (default 12)
- Last button is always `[{max}+]` and shows: "For groups of more than {max} people, please call us on {phone}"
- Selected button highlighted with brand accent colour

### Service Periods (ServicePeriods)
- **Accordion style** (not tabs or scrollable list) -- one section open at a time
- Default: expand the **latest period** that has available times (typically Dinner)
- If a period is closed/full, still shows in accordion with closeout message inside
- Clicking another period header closes the current one and opens the new one
- Period labels include special event names when applicable:
  ```
  [> Lunch 12:00 - 14:30]                    <- collapsed
  ----------------------------------------
  [v Dinner 18:00 - 21:30]                    <- expanded (default)
    [18:00] [18:30] [19:00] [19:30]
    [20:00] [20:30] [21:00]
  ----------------------------------------
  ```
- Closed/restricted period shows closeout message instead of time buttons:
  ```
  [v Dinner 18:00 - 21:30]
    "Dinner reserved for hotel guests. Call 01451 830297"
  ```
- Special event name replaces generic period label:
  ```
  [v Christmas Eve Dinner 18:00 - 21:30]
    [18:00] [18:30] [19:00]
  ```

### Time Slots (TimeSlots)
- Button grid within the expanded accordion section
- Available times as evenly-spaced buttons, similar style to party size buttons
- Selected time highlighted with brand accent
- Unavailable/past times not shown (API only returns bookable times)

### Guest Form (GuestForm)
- Clean stacked fields: Name, Email, Phone (optional), then "Are you staying?" toggle
- Dietary choices as checkboxes (fetched from resOS custom fields)
- Special requests as textarea
- Progressive reveal: hotel guest section appears below after "Yes" clicked

### Progressive Reveal
- Each section slides/fades in as the previous is completed
- Smooth CSS transitions (not jarring show/hide)
- Completed sections remain visible but visually de-emphasised (collapsed summary)
- User can click back on completed sections to change earlier selections

---

## Phase 4: Closeout Messaging + Polish

- `ClosedMessage.tsx` enhanced: parsed `%%message%%`, default fallbacks per scenario
- `##RESIDENTONLY` hint for non-residents: "Hotel guests: use the link in your confirmation email"
- Loading skeletons, error states, retry logic
- Smooth section reveal animations (CSS transitions)
- Accessibility: keyboard nav, ARIA labels, focus management
- Mobile-first responsive (calendar, time grids, stay planner all adapt)

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
|   |-- class-rbw-resident-matcher.php
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
|   |   |   |-- HotelGuestSection.tsx
|   |   |   |-- MultiNightUpsell.tsx
|   |   |   |-- GroupBookingPrompt.tsx
|   |   |   |-- ClosedMessage.tsx
|   |   |   |-- DuplicateWarning.tsx
|   |   |   |-- ResidentBanner.tsx
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

---

## Code References

| What | Source File | Lines |
|---|---|---|
| ResOS API client (all endpoints) | `resos-resident-booking-extention/sidepanel/sidepanel.js` | 124-282 |
| Booking creation payload | `resos-resident-booking-extention/sidepanel/sidepanel.js` | 1506-1537 |
| NewBook API client (staying/get) | `resos-resident-booking-extention/sidepanel/sidepanel.js` | 87-121 |
| NewBook `bookings_get` usage | `booking-match-api/includes/class-bma-newbook-search.php` | 20-38 |
| Phone normalisation (last 9 digits) | `resos-resident-booking-extention/sidepanel/sidepanel.js` | 782-787 |
| Surname extraction | `resos-resident-booking-extention/sidepanel/sidepanel.js` | 774-780 |
| Guest matching logic | `resos-resident-booking-extention/sidepanel/sidepanel.js` | 656-747 |
| GROUP/EXCLUDE field parsing | `resos-resident-booking-extention/sidepanel/sidepanel.js` | 596-617 |
| GROUP/EXCLUDE PHP parsing | `booking-match-api/includes/class-bma-matcher.php` | 1008-1050 |
| Booking# field matching (PHP) | `booking-match-api/includes/class-bma-matcher.php` | 240-255 |
| PHP booking creation + custom fields | `booking-match-api/includes/class-bma-booking-actions.php` | 638-918 |
| PHP phone formatting | `booking-match-api/includes/class-bma-booking-actions.php` | `format_phone_for_resos()` |
| PHP special events from openingHours | `booking-match-api/includes/class-bma-booking-actions.php` | 1249-1306 |
| PHP opening hours fetch | `booking-match-api/includes/class-bma-booking-actions.php` | 1043-1130 |
