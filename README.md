# DDMA — Autonomous Delivery System

A full-stack autonomous delivery platform with real-time fleet tracking. Customers create delivery orders, choose between ground robots and drones, complete payment, and watch their package travel across San Francisco on a live map — all powered by JWT + OTP authentication, OpenAPI-aligned services, and a containerized microservice deployment.

![Live Tracking](docs/screenshots/live-tracking.png)

## Tech Stack

**Backend:** Java · Spring Boot · Spring Data JDBC · Spring Security · PostgreSQL · JWT · OpenAPI
**Frontend:** React · TypeScript · Vite · Ant Design · Google Maps JavaScript API · Places API (New)
**Infrastructure:** Docker · Docker Compose · Nginx

## Highlights

- **RESTful APIs** built with Spring Boot and Spring Data JDBC, backed by PostgreSQL — covers order processing, fleet vehicle management, and OTP-based authentication workflows.
- **Interactive React + TypeScript frontend** with Ant Design, integrating Google Maps JavaScript API and Places API (New) to visualize real-time vehicle position, routes, and delivery state transitions.
- **JWT + OTP authentication** with Spring Security, multi-service deployment via Docker Compose, and frontend/backend contracts aligned through OpenAPI in Agile sprints.

## Product Walkthrough

[![Demo Video](docs/screenshots/home.png)](https://youtu.be/wI8Dqh8cqq0)

### 1. Home

Landing page — value proposition and quick navigation to the order flow.

![Home](docs/screenshots/home.png)

### 2. Create Order — Google Places Autocomplete

Address input is powered by Google's **Places API (New)** with `PlaceAutocompleteElement`, restricted to the San Francisco service area.

![Create Order](docs/screenshots/create-order.png)

### 3. Delivery Options — Robot vs. Drone

Recommendation engine surfaces feasible vehicle types based on package weight and route.

![Delivery Options](docs/screenshots/delivery-options.png)

### 4. Live Tracking

Real-time vehicle position on Google Maps with a step-by-step order progress timeline (Scheduled → Heading To Pickup → Pickup In Progress → In Transit → Delivered).

![Live Tracking](docs/screenshots/live-tracking.png)

### 5. Order History

Past deliveries with status, vehicle type, total amount, and detail navigation.

![Order History](docs/screenshots/order-history.png)

---

## Local Development

See [`backend/DeliveryManagement/`](backend/DeliveryManagement/) for the Spring Boot service and [`frontend/`](frontend/) for the React app. Full setup, seed data, and auth API verification steps are documented below.

---


# Autonomous Delivery App（自治配送）

本仓库包含产品/冲刺规划文档、**Java Spring Boot 后端**脚手架与 **Web 前端** 工程。

- **后端（Gradle / Spring Boot）**：[`backend/DeliveryManagement/`](backend/DeliveryManagement/)（详见模块内 `HELP.md`）。
- **前端开发与运行说明**（环境、`npm ci`、脚本、目录结构）：请阅读 [frontend/README.md](frontend/README.md)。
- **当前冲刺执行清单**：[`docs/Sprint0/Sprint0Backlog.md`](docs/Sprint0/Sprint0Backlog.md)（含进度与 Sprint 0 末并行轨）
- **UI 待办与前端架构**：[UIBacklog.md](UIBacklog.md)
- **产品待办**：[ProductBacklog.md](ProductBacklog.md)
- **冲刺计划**：[SprintReleasePlan.md](SprintReleasePlan.md)
- **后端与数据层技术选型讨论**：[BackendTechStackDiscussion.md](BackendTechStackDiscussion.md)
- **Java 后端分层架构与数据库 ER**：[JavaBackendArchitecture.md](JavaBackendArchitecture.md)

## PostgreSQL Installation (for Development)

### 1. Clone the Repository and Open in IntelliJ

**Clone via terminal:**

```bash
git clone https://github.com/qhuang258/DDMA-team.git
```

**Open as a Gradle project in IntelliJ:**

1. Launch IntelliJ IDEA.
2. On the Welcome screen, click **Open**.
3. Navigate into the cloned folder, go to `backend/DeliveryManagement/`, and **select `build.gradle`** (not the folder).
4. Click **Open**, then choose **Open as Project** when prompted.
5. IntelliJ will import the Gradle project and download dependencies automatically. Wait for the bottom status bar to finish syncing.

> **Note:** Always open via `build.gradle`, not the root folder. Opening the folder directly may cause IntelliJ to treat it as a plain directory and skip Gradle recognition.

### 2. Start the Database

Navigate to the directory containing `docker-compose.yml` (the project root) and run:

```bash
docker-compose up -d
```

### 3. Test the Database Connection in IntelliJ

**Connect via the Database panel**

1. Open **View → Tool Windows → Database** (or click the **Database** tab on the right sidebar).
2. Click **+** → **Data Source** → **PostgreSQL**.
3. Fill in the connection details:

| Field | Value |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database | `ddma` |
| User | `postgres` |
| Password | `secret` |

4. Click **Test Connection** — IntelliJ may prompt you to download the PostgreSQL driver; click **Download**.
5. Click **OK** to save.

After completing all 3 steps, you can run the project in IntelliJ by clicking the green **Run** button (or `Shift+F10`) on the main application class.

**Verify tables and seed data**

Once connected, open a query console (**Right-click the data source → New → Query Console**) and run:

```sql
-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verify seed data
SELECT id, email, full_name, guest FROM app_user;
SELECT id, name, address_line  FROM delivery_center;
SELECT id, vehicle_type, available, external_device_id FROM fleet_vehicle;
SELECT id, status, total_amount, currency FROM orders;
```

You should see 4 users, 3 delivery centers, 9 fleet vehicles, and 4 orders returned.

**Option 2 — psql via Docker**

First, find your container name:

```bash
docker ps
```

Look at the **NAMES** column (typically `<project-folder>-db-1`, e.g. `ddma-db-1`). Then connect:

```bash
docker exec -it ddma-db-1 psql -U postgres -d ddma
```

Once inside, useful commands:

```sql
\dt                  -- list all tables
\d app_user          -- describe a table's columns
\q                   -- quit
```

Sample SELECT queries:

```sql
-- All users
SELECT id, email, full_name, guest FROM app_user;

-- All delivery centers
SELECT id, name, address_line FROM delivery_center;

-- Available vehicles grouped by center
SELECT dc.name AS center, fv.vehicle_type, COUNT(*) AS available_count
FROM fleet_vehicle fv
JOIN delivery_center dc ON dc.id = fv.center_id
WHERE fv.available = TRUE
GROUP BY dc.name, fv.vehicle_type
ORDER BY dc.name, fv.vehicle_type;

-- All orders with user name and center
SELECT o.id, u.full_name, dc.name AS center, o.status,
       o.vehicle_type_chosen, o.total_amount, o.currency
FROM orders o
LEFT JOIN app_user u ON u.id = o.user_id
JOIN delivery_center dc ON dc.id = o.center_id
ORDER BY o.created_at DESC;

-- Orders with parcel details
SELECT o.id AS order_id, o.status, op.size_tier,
       op.weight_kg, op.fragile, op.delivery_notes
FROM orders o
JOIN order_parcel op ON op.order_id = o.id;

-- Payment status per order
SELECT o.id AS order_id, u.full_name, p.status AS payment_status,
       p.amount, p.stripe_payment_intent_id
FROM payment p
JOIN orders o ON o.id = p.order_id
LEFT JOIN app_user u ON u.id = o.user_id;

-- In-transit orders with simulated vehicle position
SELECT id, pickup_summary, dropoff_summary,
       sim_latitude, sim_longitude, sim_heading_deg, sim_updated_at
FROM orders
WHERE status = 'IN_TRANSIT';
```

## Sprint 1 Auth API Verification

Sprint 1 implements a full JWT-based auth flow. Start the app with the `dev` profile (see below), then use the following curl commands to verify end-to-end.

### Prerequisites

```bash
# 1. Start PostgreSQL
cd backend/DeliveryManagement
docker compose up -d

# 2. Start the backend (dev profile re-seeds the DB on every start)
./gradlew bootRun --args="--spring.profiles.active=dev"
```

### Step 1 — Register (initiate)

Creates a pending user and returns a one-time OTP code.

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@example.com","password":"Test1234!","full_name":"New User"}'
```

Expected response (`201 Created`):

```json
{
  "challenge_id": "<uuid>",
  "otp_code": "381924",
  "message": "OTP challenge created. Use the otp_code to complete registration."
}
```

### Step 2 — Register (complete)

Verifies the OTP and activates the account.

```bash
curl -X POST http://localhost:8080/api/v1/auth/register/complete \
  -H "Content-Type: application/json" \
  -d '{"challenge_id":"<uuid from step 1>","otp_code":"<otp_code from step 1>"}'
```

Expected response (`201 Created`):

```json
{
  "user": { "id": "...", "email": "newuser@example.com", "guest": false },
  "message": "Registration completed successfully."
}
```

### Step 3 — Login

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"newuser@example.com","password":"Test1234!"}'
```

Expected response (`200 OK`):

```json
{
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": { ... }
}
```

### Step 4 — Access a protected endpoint

```bash
curl http://localhost:8080/api/v1/centers \
  -H "Authorization: Bearer <access_token from step 3>"
```

Expected: `200 OK` with a JSON array of delivery centers.

### Dev seed accounts (already in DB)

| Email | Password | Status |
|---|---|---|
| `alice@example.com` | `AlicePass123!` | active |
| `bob@example.com` | `BobPass456!` | active |
| `pending@example.com` | `PendingPass123!` | pending (use seed challenge below) |

Seed OTP challenge for `pending@example.com`:
- `challenge_id`: `b0000002-0000-0000-0000-000000000004`
- `otp_code`: `654321`

---

## Task 3 Verification

Task 3 adds DTO classes, database-backed Service classes, and a `DevRunner` that verifies the `DTO + Service + database` chain in the `dev` profile.

Files added for this task live under:

- `backend/DeliveryManagement/src/main/java/com/laioffer/deliverymanagement/dto/`
- `backend/DeliveryManagement/src/main/java/com/laioffer/deliverymanagement/service/`
- `backend/DeliveryManagement/src/main/java/com/laioffer/deliverymanagement/DevRunner.java`

Run the verification with:

```bash
cd backend/DeliveryManagement
./gradlew bootRun --args="--spring.profiles.active=dev --spring.main.web-application-type=none"
```

What it checks on startup:

1. Each MVP table can be queried through its Service.
2. Each query can be mapped into the corresponding DTO.
3. Basic table relationships can be read successfully, such as:
   - user -> otp_challenge
   - user -> orders
   - delivery_center -> fleet_vehicle
   - order -> order_parcel
   - order -> payment

Expected prerequisite:

- The local PostgreSQL instance must accept the credentials configured in
  `backend/DeliveryManagement/src/main/resources/application.properties`,
  or you must override them with `DATABASE_URL`, `DATABASE_PORT`,
  `DATABASE_USERNAME`, and `DATABASE_PASSWORD`.
