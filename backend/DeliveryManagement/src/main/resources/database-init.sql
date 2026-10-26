-- ============================================================
-- DDMA Delivery Management - MVP Database Initialization
-- PostgreSQL | Aligned with JavaBackendArchitecture.md §3
-- Tables: app_user, otp_challenge, delivery_center,
--         fleet_vehicle, orders, order_parcel, payment
-- ============================================================

-- Enable pgcrypto for gen_random_uuid() if not already available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- This script runs on every app startup (spring.sql.init.mode=always) in every
-- environment, including docker-compose with a persistent volume. It used to
-- open with DROP TABLE IF EXISTS for all 7 tables, which meant every container
-- restart silently wiped all real data (registered users, placed orders, etc.)
-- even though the Postgres volume itself was never touched -- the app was
-- deleting its own data on every boot. Every CREATE TABLE/INDEX below is now
-- IF NOT EXISTS and every seed INSERT is ON CONFLICT (id) DO NOTHING, so this
-- is safe to re-run on an existing database: it only fills in what's missing
-- (first boot) and no-ops on anything already there (every boot after that).
-- Schema *changes* (adding/renaming a column) still need a real migration tool
-- (e.g. Flyway) -- IF NOT EXISTS does not alter an existing table.

-- ------------------------------------------------------------
-- 1. app_user
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_user (
                          id              UUID          NOT NULL DEFAULT gen_random_uuid(),
                          email           VARCHAR(255),
                          phone           VARCHAR(50),
                          password_hash   VARCHAR(255),
                          full_name       VARCHAR(255),
                          guest           BOOLEAN       NOT NULL DEFAULT FALSE,
                          created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
                          updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
                          version         INTEGER       NOT NULL DEFAULT 0,
                          metadata        JSONB,

                          CONSTRAINT pk_app_user PRIMARY KEY (id),
                          CONSTRAINT uq_app_user_email UNIQUE (email),
                          CONSTRAINT uq_app_user_phone UNIQUE (phone)
);

-- ------------------------------------------------------------
-- 2. otp_challenge
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_challenge (
                               id            UUID         NOT NULL DEFAULT gen_random_uuid(),
                               user_id       UUID,
                               channel       VARCHAR(20)  NOT NULL,
                               code_hash     VARCHAR(255) NOT NULL,
                               expires_at    TIMESTAMPTZ  NOT NULL,
                               consumed      BOOLEAN      NOT NULL DEFAULT FALSE,
                               attempt_count SMALLINT     NOT NULL DEFAULT 0,
                               created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

                               CONSTRAINT pk_otp_challenge PRIMARY KEY (id),
                               CONSTRAINT fk_otp_challenge_user FOREIGN KEY (user_id)
                                   REFERENCES app_user (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_otp_challenge_user_id ON otp_challenge (user_id);

-- ------------------------------------------------------------
-- 3. delivery_center
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_center (
                                 id               UUID           NOT NULL DEFAULT gen_random_uuid(),
                                 name             VARCHAR(255)   NOT NULL,
                                 latitude         NUMERIC(10, 7) NOT NULL,
                                 longitude        NUMERIC(10, 7) NOT NULL,
                                 address_line     VARCHAR(500),
                                 service_area_geo JSONB,
                                 metadata         JSONB,

                                 CONSTRAINT pk_delivery_center PRIMARY KEY (id)
);

-- ------------------------------------------------------------
-- 4. fleet_vehicle
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fleet_vehicle (
                               id                 UUID         NOT NULL DEFAULT gen_random_uuid(),
                               center_id          UUID         NOT NULL,
                               vehicle_type       VARCHAR(50)  NOT NULL,
                               available          BOOLEAN      NOT NULL DEFAULT TRUE,
                               external_device_id VARCHAR(255),
                               telemetry_hint     JSONB,
                               metadata           JSONB,

                               CONSTRAINT pk_fleet_vehicle PRIMARY KEY (id),
                               CONSTRAINT fk_fleet_vehicle_center FOREIGN KEY (center_id)
                                   REFERENCES delivery_center (id) ON DELETE RESTRICT,
                               CONSTRAINT chk_fleet_vehicle_type CHECK (vehicle_type IN ('DRONE', 'ROBOT'))
);

CREATE INDEX IF NOT EXISTS idx_fleet_vehicle_center_id ON fleet_vehicle (center_id);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicle_available ON fleet_vehicle (available);

-- ------------------------------------------------------------
-- 5. orders
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
                        id                  UUID           NOT NULL DEFAULT gen_random_uuid(),
                        user_id             UUID,
                        center_id           UUID           NOT NULL,
                        fleet_vehicle_id    UUID,
                        status              VARCHAR(50)    NOT NULL,
                        vehicle_type_chosen VARCHAR(50),
                        pickup_summary      VARCHAR(500),
                        dropoff_summary     VARCHAR(500),
                        handoff_pin         VARCHAR(20),
                        estimated_minutes   INTEGER,
                        total_amount        NUMERIC(12, 2),
                        currency            VARCHAR(10)    NOT NULL DEFAULT 'USD',

                        sim_latitude        NUMERIC(10, 7),
                        sim_longitude       NUMERIC(10, 7),
                        sim_heading_deg     NUMERIC(6, 2),
                        sim_updated_at      TIMESTAMPTZ,

                        plan_snapshot       JSONB,
                        tracking_state      JSONB,

                        created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
                        updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
                        version             INTEGER        NOT NULL DEFAULT 0,
                        metadata            JSONB,

                        CONSTRAINT pk_orders PRIMARY KEY (id),
                        CONSTRAINT fk_orders_user FOREIGN KEY (user_id)
                            REFERENCES app_user (id) ON DELETE SET NULL,
                        CONSTRAINT fk_orders_center FOREIGN KEY (center_id)
                            REFERENCES delivery_center (id) ON DELETE RESTRICT,
                        CONSTRAINT fk_orders_fleet_vehicle FOREIGN KEY (fleet_vehicle_id)
                            REFERENCES fleet_vehicle (id) ON DELETE SET NULL,
                        CONSTRAINT chk_orders_vehicle_type_chosen CHECK (
                            vehicle_type_chosen IS NULL OR vehicle_type_chosen IN ('DRONE', 'ROBOT')
                            )
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_center_id ON orders (center_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

-- ------------------------------------------------------------
-- 6. order_parcel
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_parcel (
                              id             UUID          NOT NULL DEFAULT gen_random_uuid(),
                              order_id       UUID          NOT NULL,
                              size_tier      VARCHAR(20)   NOT NULL,
                              weight_kg      NUMERIC(8, 3) NOT NULL,
                              fragile        BOOLEAN       NOT NULL DEFAULT FALSE,
                              delivery_notes TEXT,
                              dimensions     JSONB,
                              metadata       JSONB,

                              CONSTRAINT pk_order_parcel PRIMARY KEY (id),
                              CONSTRAINT uq_order_parcel_order UNIQUE (order_id),
                              CONSTRAINT fk_order_parcel_order FOREIGN KEY (order_id)
                                  REFERENCES orders (id) ON DELETE CASCADE,
                              CONSTRAINT chk_order_parcel_size_tier CHECK (size_tier IN ('S', 'M', 'L'))
);

CREATE INDEX IF NOT EXISTS idx_order_parcel_order_id ON order_parcel (order_id);

-- ------------------------------------------------------------
-- 7. payment
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment (
                         id                       UUID           NOT NULL DEFAULT gen_random_uuid(),
                         order_id                 UUID           NOT NULL,
                         stripe_payment_intent_id VARCHAR(255),
                         status                   VARCHAR(50)    NOT NULL,
                         amount                   NUMERIC(12, 2) NOT NULL,
                         currency                 VARCHAR(10)    NOT NULL DEFAULT 'USD',
                         idempotency_key          VARCHAR(255),
                         created_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
                         updated_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
                         provider_payload         JSONB,

                         CONSTRAINT pk_payment PRIMARY KEY (id),
                         CONSTRAINT uq_payment_order UNIQUE (order_id),
                         CONSTRAINT uq_payment_idempotency_key UNIQUE (idempotency_key),
                         CONSTRAINT fk_payment_order FOREIGN KEY (order_id)
                             REFERENCES orders (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_payment_stripe_intent ON payment (stripe_payment_intent_id);

-- ============================================================
-- SEED DATA
-- ============================================================

-- ------------------------------------------------------------
-- app_user
-- ------------------------------------------------------------
INSERT INTO app_user (id, email, phone, password_hash, full_name, guest)
VALUES
    ('a0000001-0000-0000-0000-000000000001', 'alice@example.com', '+14155550101', 'sha256$aliceSalt$31ec0d3708f9c886bbc8f70ac847795a8ea71535fc1db6e711487ea59f8f4a46', 'Alice Chen', FALSE),
    ('a0000001-0000-0000-0000-000000000002', 'bob@example.com', '+14155550102', 'sha256$bobSalt$1ec3e83c8f525fadf8437624398e75579cd6ae9a62b11d808b5d4d549d0a3dcd', 'Bob Martinez', FALSE),
    ('a0000001-0000-0000-0000-000000000003', 'carol@example.com', '+14155550103', 'sha256$carolSalt$4bee9d51fab068ec13f9a89e7c8cf3ff3129e16699c392e310fe4592f3063d5a', 'Carol Park', FALSE),
    ('a0000001-0000-0000-0000-000000000004', NULL, '+14155550199', NULL, NULL, TRUE),
    ('a0000001-0000-0000-0000-000000000005', 'pending@example.com', '+14155550105', 'sha256$pendingSalt$c63209282759b51bcc411cc5d69a608141d5ed00bba5cb12dd223a5ac21445b5', 'Pending User', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- otp_challenge
-- ------------------------------------------------------------
INSERT INTO otp_challenge (id, user_id, channel, code_hash, expires_at, consumed, attempt_count)
VALUES
    ('b0000002-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'EMAIL', 'sha256$otpAlice$02a1fc10e82fa1f18474c1f855f8aa7970d3c75e55e12a6edcef583e7ac0ae1a', NOW() - INTERVAL '10 minutes', TRUE, 1),
    ('b0000002-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000002', 'SMS', 'sha256$otpBob$534eb235657f0ae5f91c259330aee47a122afedf1ba994f6843e19f88d52a107', NOW() + INTERVAL '5 minutes', FALSE, 0),
    ('b0000002-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000003', 'EMAIL', 'sha256$otpCarol$a77c553287177af63c0a8ec405bff36f25d6033b41666eab87e34618cdad430c', NOW() - INTERVAL '1 hour', FALSE, 3),
    ('b0000002-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000005', 'EMAIL', 'sha256$otpPending$cbada3f76f911740f875647953788c43c9ffdec79b400aa711aaad144726fe58', NOW() + INTERVAL '30 minutes', FALSE, 0)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- delivery_center
-- ------------------------------------------------------------
INSERT INTO delivery_center (id, name, latitude, longitude, address_line, service_area_geo)
VALUES
    ('c0000003-0000-0000-0000-000000000001', 'SoMa Hub', 37.7785, -122.4056, '123 Brannan St, San Francisco, CA 94107',
     '{"type":"Polygon","coordinates":[[[-122.42,37.77],[-122.39,37.77],[-122.39,37.79],[-122.42,37.79],[-122.42,37.77]]]}'),
    ('c0000003-0000-0000-0000-000000000002', 'Mission Hub', 37.7599, -122.4148, '456 Valencia St, San Francisco, CA 94110',
     '{"type":"Polygon","coordinates":[[[-122.43,37.75],[-122.40,37.75],[-122.40,37.77],[-122.43,37.77],[-122.43,37.75]]]}'),
    ('c0000003-0000-0000-0000-000000000003', 'Castro Hub', 37.7609, -122.4350, '789 Market St, San Francisco, CA 94114',
     '{"type":"Polygon","coordinates":[[[-122.45,37.75],[-122.42,37.75],[-122.42,37.77],[-122.45,37.77],[-122.45,37.75]]]}')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- fleet_vehicle
-- ------------------------------------------------------------
INSERT INTO fleet_vehicle (id, center_id, vehicle_type, available, external_device_id)
VALUES
    ('d0000004-0000-0000-0000-000000000001', 'c0000003-0000-0000-0000-000000000001', 'DRONE', TRUE,  'DRN-SOMA-01'),
    ('d0000004-0000-0000-0000-000000000002', 'c0000003-0000-0000-0000-000000000001', 'DRONE', FALSE, 'DRN-SOMA-02'),
    ('d0000004-0000-0000-0000-000000000003', 'c0000003-0000-0000-0000-000000000001', 'ROBOT', TRUE,  'RBT-SOMA-01'),
    ('d0000004-0000-0000-0000-000000000004', 'c0000003-0000-0000-0000-000000000002', 'DRONE', TRUE,  'DRN-MISS-01'),
    ('d0000004-0000-0000-0000-000000000005', 'c0000003-0000-0000-0000-000000000002', 'DRONE', TRUE,  'DRN-MISS-02'),
    ('d0000004-0000-0000-0000-000000000006', 'c0000003-0000-0000-0000-000000000002', 'ROBOT', FALSE, 'RBT-MISS-01'),
    ('d0000004-0000-0000-0000-000000000007', 'c0000003-0000-0000-0000-000000000003', 'DRONE', TRUE,  'DRN-CAST-01'),
    ('d0000004-0000-0000-0000-000000000008', 'c0000003-0000-0000-0000-000000000003', 'ROBOT', TRUE,  'RBT-CAST-01'),
    ('d0000004-0000-0000-0000-000000000009', 'c0000003-0000-0000-0000-000000000003', 'ROBOT', FALSE, 'RBT-CAST-02')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- orders
-- ------------------------------------------------------------
INSERT INTO orders (
    id, user_id, center_id, fleet_vehicle_id, status, vehicle_type_chosen,
    pickup_summary, dropoff_summary, handoff_pin,
    estimated_minutes, total_amount, currency,
    sim_latitude, sim_longitude, sim_heading_deg, sim_updated_at,
    plan_snapshot, tracking_state
)
VALUES
    ('e0000005-0000-0000-0000-000000000001',
     'a0000001-0000-0000-0000-000000000001',
     'c0000003-0000-0000-0000-000000000001',
     'd0000004-0000-0000-0000-000000000001',
     'DELIVERED', 'DRONE',
     '37 Main St, San Francisco, CA', '88 Folsom St, San Francisco, CA',
     '4821', 18, 12.50, 'USD',
     37.7850, -122.3985, 92.5, NOW() - INTERVAL '2 hours',
     '{"route":"SoMa-direct","distanceKm":1.2}',
     '{"lastEvent":"DELIVERED","deliveredAt":"2026-03-25T08:00:00Z"}'),

    ('e0000005-0000-0000-0000-000000000002',
     'a0000001-0000-0000-0000-000000000002',
     'c0000003-0000-0000-0000-000000000002',
     'd0000004-0000-0000-0000-000000000006',
     'IN_TRANSIT', 'ROBOT',
     '200 Valencia St, San Francisco, CA', '500 Guerrero St, San Francisco, CA',
     '7743', 25, 9.75, 'USD',
     37.8000, -122.4500, 180.0, NOW() - INTERVAL '5 minutes',
     '{"route":"Mission-loop","distanceKm":0.8}',
     '{"lastEvent":"PICKED_UP","dropoffLat":37.7550,"dropoffLng":-122.4350}'),

    ('e0000005-0000-0000-0000-000000000003',
     'a0000001-0000-0000-0000-000000000003',
     'c0000003-0000-0000-0000-000000000003',
     NULL,
     'PENDING', 'DRONE',
     '100 Castro St, San Francisco, CA', '300 Noe St, San Francisco, CA',
     NULL, 20, 14.00, 'USD',
     NULL, NULL, NULL, NULL,
     NULL, NULL),

    ('e0000005-0000-0000-0000-000000000004',
     'a0000001-0000-0000-0000-000000000004',
     'c0000003-0000-0000-0000-000000000001',
     NULL,
     'CANCELLED', 'ROBOT',
     '50 Brannan St, San Francisco, CA', '150 King St, San Francisco, CA',
     NULL, NULL, 0.00, 'USD',
     NULL, NULL, NULL, NULL,
     NULL, '{"lastEvent":"CANCELLED","reason":"payment_failed"}')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- order_parcel
-- ------------------------------------------------------------
INSERT INTO order_parcel (id, order_id, size_tier, weight_kg, fragile, delivery_notes, dimensions)
VALUES
    ('f0000006-0000-0000-0000-000000000001', 'e0000005-0000-0000-0000-000000000001', 'S', 0.500, FALSE, NULL,
     '{"lengthCm":15,"widthCm":10,"heightCm":8}'),
    ('f0000006-0000-0000-0000-000000000002', 'e0000005-0000-0000-0000-000000000002', 'M', 1.200, TRUE, 'Handle with care - glassware',
     '{"lengthCm":25,"widthCm":20,"heightCm":15}'),
    ('f0000006-0000-0000-0000-000000000003', 'e0000005-0000-0000-0000-000000000003', 'L', 2.800, FALSE, 'Leave at door',
     '{"lengthCm":40,"widthCm":30,"heightCm":20}'),
    ('f0000006-0000-0000-0000-000000000004', 'e0000005-0000-0000-0000-000000000004', 'S', 0.300, FALSE, NULL,
     '{"lengthCm":12,"widthCm":8,"heightCm":6}')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- payment
-- ------------------------------------------------------------
INSERT INTO payment (id, order_id, stripe_payment_intent_id, status, amount, currency, idempotency_key, provider_payload)
VALUES
    ('70000007-0000-0000-0000-000000000001', 'e0000005-0000-0000-0000-000000000001',
     'pi_test_alice_succeeded', 'SUCCEEDED', 12.50, 'USD', 'idem-alice-ord-001',
     '{"receiptUrl":"https://pay.stripe.com/receipts/test_alice"}'),
    ('70000007-0000-0000-0000-000000000002', 'e0000005-0000-0000-0000-000000000002',
     'pi_test_bob_pending', 'PENDING', 9.75, 'USD', 'idem-bob-ord-002',
     '{}'),
    ('70000007-0000-0000-0000-000000000003', 'e0000005-0000-0000-0000-000000000003',
     NULL, 'PENDING', 14.00, 'USD', 'idem-carol-ord-003',
     '{}'),
    ('70000007-0000-0000-0000-000000000004', 'e0000005-0000-0000-0000-000000000004',
     'pi_test_guest_failed', 'FAILED', 0.00, 'USD', 'idem-guest-ord-004',
     '{"failureCode":"card_declined"}')
ON CONFLICT (id) DO NOTHING;
