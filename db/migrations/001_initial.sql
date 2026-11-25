-- Schéma initial. Toutes les dates sont stockées en UTC (timestamptz).
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE services (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  description   text NOT NULL DEFAULT '',
  category      text NOT NULL CHECK (category IN ('women', 'men', 'children')),
  duration_min  integer NOT NULL CHECK (duration_min > 0 AND duration_min <= 480),
  price_cents   integer NOT NULL CHECK (price_cents >= 0),
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0
);

CREATE TABLE stylists (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  display_name  text NOT NULL,
  specialty     text NOT NULL DEFAULT '',
  bio           text NOT NULL DEFAULT '',
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0
);

CREATE TABLE stylist_services (
  stylist_id  uuid NOT NULL REFERENCES stylists(id) ON DELETE CASCADE,
  service_id  uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (stylist_id, service_id)
);

-- Horaires hebdomadaires en heure locale du salon (Europe/Paris). weekday : 1 = lundi … 7 = dimanche (ISO).
CREATE TABLE working_hours (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stylist_id  uuid NOT NULL REFERENCES stylists(id) ON DELETE CASCADE,
  weekday     smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  CHECK (end_time > start_time)
);
CREATE INDEX working_hours_stylist_idx ON working_hours (stylist_id, weekday);

CREATE TABLE time_off (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stylist_id  uuid NOT NULL REFERENCES stylists(id) ON DELETE CASCADE,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  reason      text NOT NULL DEFAULT '',
  CHECK (ends_at > starts_at)
);
CREATE INDEX time_off_range_idx ON time_off (stylist_id, starts_at, ends_at);

CREATE TABLE closures (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  reason     text NOT NULL DEFAULT '',
  CHECK (ends_at > starts_at)
);

CREATE TABLE bookings (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id             uuid NOT NULL REFERENCES services(id),
  stylist_id             uuid NOT NULL REFERENCES stylists(id),
  starts_at              timestamptz NOT NULL,
  ends_at                timestamptz NOT NULL,
  status                 text NOT NULL DEFAULT 'confirmed'
                         CHECK (status IN ('confirmed', 'cancelled_by_client', 'cancelled_by_salon', 'completed', 'no_show')),
  customer_name          text NOT NULL,
  customer_email         text NOT NULL,
  customer_phone         text,
  note                   text,
  service_name           text NOT NULL,
  price_cents            integer NOT NULL,
  duration_min           integer NOT NULL,
  manage_token_hash      char(64) NOT NULL UNIQUE,
  privacy_notice_version text NOT NULL,
  reminder_sent_at       timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  cancelled_at           timestamptz,
  anonymised_at          timestamptz,
  CHECK (ends_at > starts_at),
  -- Garantie centrale : un coiffeur ne peut pas avoir deux rendez-vous confirmés qui se chevauchent.
  CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
    stylist_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status = 'confirmed')
);
CREATE INDEX bookings_starts_at_idx ON bookings (starts_at);
CREATE INDEX bookings_email_idx ON bookings (lower(customer_email));

CREATE TABLE admin_sessions (
  id_hash     char(64) PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

-- Compteurs de limitation de débit (connexion admin, réservations, formulaire de contact).
CREATE TABLE rate_limit_events (
  id          bigserial PRIMARY KEY,
  key         text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rate_limit_events_key_idx ON rate_limit_events (key, created_at);

CREATE TABLE contact_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       text NOT NULL,
  message     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE email_log (
  id          bigserial PRIMARY KEY,
  booking_id  uuid REFERENCES bookings(id) ON DELETE SET NULL,
  kind        text NOT NULL CHECK (kind IN ('confirmation', 'reminder', 'cancellation', 'cancellation_salon', 'contact')),
  status      text NOT NULL CHECK (status IN ('sent', 'failed', 'logged')),
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
