// DDMA end-to-end load test.
//
// Simulates the real user flow (not just hitting isolated endpoints):
// login -> list center vehicles -> create order -> add parcel -> pay
// (assigns a fleet vehicle) -> poll tracking 3x at 1s intervals, mirroring
// the frontend's real 3-second tracking poll (see
// frontend/src/pages/tracking/TrackingPage.tsx).
//
// Prereqs: seed with gen_seed.py first (see loadtest/README.md for the
// full run sequence against an isolated test DB).
//
// Run:
//   k6 run loadtest.js
//   k6 run --summary-export=results.json loadtest.js
//   BASE_URL=http://localhost:8080 k6 run loadtest.js

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const N_USERS = 2000; // must match --users passed to gen_seed.py
const PASSWORD = "LoadTest123!";

const orderCreateFail = new Counter("order_create_fail");
const payFail = new Counter("pay_fail");
const trackingTrend = new Trend("tracking_duration");

export const options = {
  scenarios: {
    delivery_flow: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 50 },
        { duration: "30s", target: 200 },
        { duration: "1m", target: 200 },
        { duration: "20s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    "http_req_duration{endpoint:login}": ["p(95)<800"],
    "http_req_duration{endpoint:create_order}": ["p(95)<1000"],
    "http_req_duration{endpoint:pay_order}": ["p(95)<1000"],
    "http_req_duration{endpoint:tracking}": ["p(95)<500"],
  },
};

// Deterministic SF bounding box (matches AddressValidationService.SF_POLYGON)
function randomSfPoint() {
  const lat = 37.7080 + Math.random() * (37.8120 - 37.7080);
  const lng = -122.5150 + Math.random() * (-122.3550 - -122.5150);
  return { lat, lng };
}

export function setup() {
  const res = http.get(`${BASE_URL}/api/v1/centers`);
  check(res, { "centers loaded": (r) => r.status === 200 });
  const centers = res.json();
  return { centerIds: centers.map((c) => c.id) };
}

export default function (data) {
  const userIdx = ((__VU - 1) % N_USERS) + 1;
  const email = `loadtest_user_${String(userIdx).padStart(5, "0")}@example.com`;

  // 1. Login
  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ identifier: email, password: PASSWORD }),
    { headers: { "Content-Type": "application/json" }, tags: { endpoint: "login" } },
  );
  const loginOk = check(loginRes, { "login 200": (r) => r.status === 200 });
  if (!loginOk) {
    sleep(1);
    return;
  }
  const token = loginRes.json("access_token");
  const authHeaders = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  // 2. Pick a center, list its vehicles (mirrors RecommendationsPage.tsx)
  const centerId = data.centerIds[Math.floor(Math.random() * data.centerIds.length)];
  const vehiclesRes = http.get(`${BASE_URL}/api/v1/centers/${centerId}/vehicles`, {
    ...authHeaders,
    tags: { endpoint: "list_vehicles" },
  });
  check(vehiclesRes, { "vehicles 200": (r) => r.status === 200 });

  // 3. Create order
  const pickup = randomSfPoint();
  const dropoff = randomSfPoint();
  const createRes = http.post(
    `${BASE_URL}/api/v1/orders`,
    JSON.stringify({
      center_id: centerId,
      pickup_address: "Load Test Pickup, San Francisco, CA",
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      dropoff_address: "Load Test Dropoff, San Francisco, CA",
      dropoff_lat: dropoff.lat,
      dropoff_lng: dropoff.lng,
    }),
    { ...authHeaders, tags: { endpoint: "create_order" } },
  );
  const createOk = check(createRes, { "order created": (r) => r.status === 201 });
  if (!createOk) {
    orderCreateFail.add(1);
    sleep(1);
    return;
  }
  // CreateOrderResponse.orderId -> JSON snake_case: order_id (NOT "id" -- see
  // controller/CreateOrderResponse.java; easy to get wrong, caught during the
  // original smoke test).
  const orderId = createRes.json("order_id");

  // 4. Add parcel
  const parcelRes = http.post(
    `${BASE_URL}/api/v1/orders/${orderId}/parcels`,
    JSON.stringify({
      size_tier: "S",
      weight_kg: 0.8,
      fragile: false,
      delivery_notes: "load test parcel",
    }),
    { ...authHeaders, tags: { endpoint: "add_parcel" } },
  );
  check(parcelRes, { "parcel created": (r) => r.status === 201 });

  // 5. Pay (assigns a vehicle, kicks off tracking)
  const vehicleType = Math.random() < 0.5 ? "ROBOT" : "DRONE";
  const payRes = http.post(
    `${BASE_URL}/api/v1/orders/${orderId}/pay`,
    JSON.stringify({
      vehicle_type: vehicleType,
      price_usd: 12.5,
      eta_minutes: 20,
    }),
    { ...authHeaders, tags: { endpoint: "pay_order" } },
  );
  const payOk = check(payRes, { "order paid": (r) => r.status === 200 });
  if (!payOk) {
    payFail.add(1);
    sleep(1);
    return;
  }

  // 6. Poll tracking a few times, mimicking the frontend's 3s polling
  for (let i = 0; i < 3; i++) {
    const trackRes = http.get(`${BASE_URL}/api/v1/orders/${orderId}/tracking`, {
      ...authHeaders,
      tags: { endpoint: "tracking" },
    });
    check(trackRes, { "tracking 200": (r) => r.status === 200 });
    trackingTrend.add(trackRes.timings.duration);
    sleep(1);
  }

  sleep(Math.random() * 2);
}
