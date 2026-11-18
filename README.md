# Delivery Management & Proof-of-Delivery (PoD) Application

> **Note to Coding AI / Development Agents:** This document serves as the primary architectural blueprint, functional specification, and implementation guide for this project. Adhere strictly to the **Tech Stack**, **Security Constraints**, and **Workflow Rules** defined below. Do not substitute the specified UI framework, database, or migration tool.

---

## 1. Project Overview

This is a full-stack delivery management system consisting of two primary interfaces:
1. **Admin Portal:** A high-security management dashboard for provisioning users, creating and dispatching deliveries, monitoring active/past deliveries, reviewing audit logs, receiving real-time alerts, and manually blocking suspicious IP addresses.
2. **Driver Portal:** A streamlined, mobile-first interface designed for delivery drivers to scan package QR codes, capture photographic proof of delivery, collect customer signatures, and automatically log geolocation upon completion.

---

## 2. Tech Stack & Strict Constraints

| Layer | Technology | Notes / Constraints |
| :--- | :--- | :--- |
| **Frontend** | **Angular** (TypeScript) | Separate feature modules/routes for `Admin` and `Driver` views. |
| **UI Framework** | **jQWidgets** (`jqwidgets-framework` / `jqwidgets-ng`) | **Mandatory.** Use `jqwidgets-framework` components (e.g., `jqxGrid`, `jqxButton`, `jqxNotification`, `jqxWindow`) for Admin data tables, forms, and alerts. |
| **Backend** | **Node.js** (TypeScript + Express) | RESTful API with modular controller/service/repository architecture. |
| **Database** | **PostgreSQL** | Primary relational datastore. |
| **DB Migrations** | **Sqitch** | **Mandatory.** All schema changes must be managed via Sqitch (`deploy/`, `revert/`, `verify/` scripts). Do not use ORM auto-sync. |
| **Real-Time** | **WebSockets** (`socket.io` or `ws`) & **Webhooks** | Push real-time alerts and delivery status updates to connected Admin clients; support outgoing webhooks for external integrations. |
| **Media Storage** | Local Encrypted Storage or S3-compatible Bucket | Store Proof of Delivery photos and signature images securely; store only metadata and secure file references in PostgreSQL. |

---

## 3. Functional Requirements

### 3.1 Admin Portal (High Security)
Because the Admin Portal handles sensitive customer, user, and operational data, strict authentication, authorization (RBAC), and auditing are required.

* **User Provisioning:**
  * Admins can create, update, deactivate, and manage **Driver** accounts and other **Admin** accounts.
  * Enforce strong password policies (bcrypt/Argon2 hashing) and role-based access control (`ADMIN`, `DRIVER`).
* **Delivery Management:**
  * Create new deliveries with a unique `delivery_number` and/or `tracking_number` (used to generate/match the package QR code).
  * Assign/dispatch deliveries to the driver side of the application.
  * View **Active Deliveries** (e.g., `PENDING`, `IN_TRANSIT`) and **Past Deliveries** (`DELIVERED`, `CANCELLED`), including full Proof of Delivery artifacts (photo, signature, timestamp, GPS coordinates).
* **Audit Logging:**
  * Record all significant user actions (logins, failed logins, delivery creation, status changes, user provisioning, IP blocks) in an immutable `audit_logs` table.
  * Admins can search, filter, and review audit logs via a `jqxGrid` table.
* **Manual IP Blocking:**
  * Track IP addresses associated with unauthenticated or suspicious requests in the audit logs.
  * Admins must be able to **manually** add or remove IP addresses from a blocklist.
  * **CRITICAL CONSTRAINT:** IP blocking **MUST be triggered manually by an Admin**. Do **NOT** implement automatic IP banning/blocking logic.
* **Real-Time Alerts & Notifications:**
  * Admins receive live alerts via WebSockets (displayed via `jqxNotification` or toast banners) when:
    * A delivery is completed by a driver.
    * A delivery status changes.
    * Unauthenticated access attempts occur.
    * Admin actions (e.g., user provisioning, IP blocking) are executed.

### 3.2 Driver Portal (Streamlined Mobile Workflow)
The Driver UI must be minimal, fast, and optimized for mobile browsers/devices with camera and GPS access.

* **Step 1: QR Code Scan:**
  * Driver opens the scanner (using HTML5 camera API / Angular QR scanner library) and scans the QR code on the package.
  * The scanned payload resolves to the `delivery_number` or `tracking_number` and fetches the corresponding active delivery.
* **Step 2: Photo Capture (Proof of Delivery):**
  * Immediately after a valid QR scan, the driver must capture a photo of the delivered package using the device camera.
* **Step 3: Customer Signature:**
  * After photo capture, the driver presents a touch-enabled signature canvas to capture the customer's signature.
* **Step 4: Geolocation & Completion:**
  * Upon submission, the app captures the device's current GPS coordinates (`latitude`, `longitude`, and `accuracy`) via the browser Geolocation API.
  * The photo, signature, and GPS data are uploaded to the backend.
  * The delivery status is updated to `DELIVERED`, the Proof of Delivery record is permanently saved, and a real-time WebSocket/Webhook event is dispatched to the Admin Portal.

---

## 4. Database Schema & Sqitch Migration Plan

All database changes must be authored as Sqitch plans in `/database`.

### Core Tables
1. **`users`**
   * `id` (UUID, PK), `email` (VARCHAR, UNIQUE), `password_hash` (TEXT), `full_name` (VARCHAR), `role` (`ADMIN` | `DRIVER`), `is_active` (BOOLEAN), `created_by` (UUID, FK -> `users.id`), `created_at`, `updated_at`.
2. **`deliveries`**
   * `id` (UUID, PK), `delivery_number` (VARCHAR, UNIQUE), `tracking_number` (VARCHAR, UNIQUE), `assigned_driver_id` (UUID, FK -> `users.id`, nullable), `status` (`PENDING` | `ASSIGNED` | `DELIVERED` | `CANCELLED`), `recipient_name` (VARCHAR), `delivery_address` (TEXT), `created_by` (UUID, FK -> `users.id`), `created_at`, `updated_at`, `completed_at` (TIMESTAMP, nullable).
3. **`proof_of_delivery`**
   * `id` (UUID, PK), `delivery_id` (UUID, UNIQUE, FK -> `deliveries.id`), `driver_id` (UUID, FK -> `users.id`), `photo_url` (TEXT, NOT NULL), `signature_url` (TEXT, NOT NULL), `latitude` (DECIMAL(9,6), NOT NULL), `longitude` (DECIMAL(9,6), NOT NULL), `captured_at` (TIMESTAMP, NOT NULL).
4. **`audit_logs`**
   * `id` (BIGSERIAL, PK), `user_id` (UUID, FK -> `users.id`, nullable for unauthenticated requests), `action` (VARCHAR, NOT NULL), `entity_type` (VARCHAR), `entity_id` (VARCHAR), `ip_address` (INET, NOT NULL), `user_agent` (TEXT), `metadata` (JSONB), `created_at` (TIMESTAMP, DEFAULT NOW()).
5. **`blocked_ips`**
   * `id` (UUID, PK), `ip_address` (INET, UNIQUE, NOT NULL), `reason` (TEXT), `blocked_by` (UUID, FK -> `users.id`, NOT NULL), `is_active` (BOOLEAN, DEFAULT TRUE), `created_at` (TIMESTAMP, DEFAULT NOW()).
6. **`webhooks`** (Optional/Configurable)
   * `id` (UUID, PK), `target_url` (TEXT, NOT NULL), `secret_key` (TEXT, NOT NULL), `events` (TEXT[]), `is_active` (BOOLEAN), `created_at`.

### Sqitch Workflow
```bash
# Initialize Sqitch (if not already initialized)
cd database
sqitch init delivery_app --engine pg

# Example: Add a migration
sqitch add create_core_tables -n "Create users, deliveries, PoD, audit_logs, and blocked_ips tables"

# Deploy migrations to PostgreSQL
sqitch deploy db:pg://<user>:<password>@<host>:<port>/<dbname>

# Verify migrations
sqitch verify db:pg://<user>:<password>@<host>:<port>/<dbname>
```

---

## 5. API & Real-Time Specification

### REST API Endpoints (`/api/v1`)

#### Auth
* `POST /auth/login` — Authenticate Admin or Driver (returns JWT; logs IP & action).
* `POST /auth/logout` — Invalidate session/token.

#### Admin — User Provisioning (`ADMIN` role required)
* `GET /admin/users` — List all admins and drivers.
* `POST /admin/users` — Provision a new admin or driver.
* `PATCH /admin/users/:id` — Update user details or active status.

#### Admin — Deliveries (`ADMIN` role required)
* `POST /admin/deliveries` — Create a new delivery (`delivery_number`, `tracking_number`, driver assignment).
* `GET /admin/deliveries` — List deliveries (filterable by `status=active|past`).
* `GET /admin/deliveries/:id` — Get full delivery details including PoD photo, signature, and GPS coordinates.

#### Admin — Security & Audit (`ADMIN` role required)
* `GET /admin/audit-logs` — Paginated/filterable log of all user actions and unauthenticated attempts.
* `GET /admin/blocked-ips` — List manually blocked IP addresses.
* `POST /admin/blocked-ips` — Manually block an IP address (`ip_address`, `reason`).
* `DELETE /admin/blocked-ips/:id` — Unblock an IP address.

#### Driver — Delivery Execution (`DRIVER` role required)
* `GET /driver/deliveries/scan/:code` — Look up an active delivery by scanned QR code (`delivery_number` or `tracking_number`).
* `POST /driver/deliveries/:id/complete` — Multipart form submission accepting:
  * `photo` (Image file)
  * `signature` (Image file / Base64 PNG)
  * `latitude` & `longitude` (Coordinates)
  * Marks delivery as `DELIVERED` and triggers Admin WebSocket/Webhook alerts.

### WebSocket Events (Namespace: `/admin-alerts`)
* **Auth:** Require valid `ADMIN` JWT during WebSocket handshake.
* **Server -> Client Events:**
  * `delivery:created` — Payload: `{ deliveryId, trackingNumber, createdBy }`
  * `delivery:completed` — Payload: `{ deliveryId, trackingNumber, driverId, completedAt, location }`
  * `security:unauthenticated_attempt` — Payload: `{ ipAddress, endpoint, timestamp }`
  * `security:ip_blocked` — Payload: `{ ipAddress, blockedBy, reason }`

---

## 6. Security Implementation Guidelines

1. **IP Blocklist Middleware:** Every incoming HTTP request must pass through an Express middleware that checks `req.ip` against active entries in `blocked_ips` (cached in memory/Redis for performance, invalidated on manual admin update). Return `403 Forbidden` if matched.
2. **Audit Middleware:** Automatically log unauthenticated attempts (401/403) with the requester's IP address so Admins can review and manually block them if necessary.
3. **Authentication & Transport:** Use JWTs with short expiration + refresh tokens (or `HttpOnly`, `Secure`, `SameSite=Strict` cookies). Enforce HTTPS/TLS in production.
4. **File Upload Security:** Validate MIME types (`image/jpeg`, `image/png`, `image/webp`) and file size limits on PoD uploads. Strip EXIF metadata if needed, and serve PoD images only through authenticated Admin endpoints (never expose raw public URLs).
5. **Input Validation:** Validate all request payloads using `zod` or `joi`. Use parameterized SQL queries (`pg` library) exclusively to prevent SQL injection.

---

## 7. Recommended Repository Structure

```text
delivery-app/
├── database/                  # Sqitch migrations
│   ├── sqitch.conf
│   ├── sqitch.plan
│   ├── deploy/
│   ├── revert/
│   └── verify/
├── backend/                   # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── config/            # DB pool, env vars, storage config
│   │   ├── middleware/        # auth, rbac, manualIpBlock, auditLogger, upload
│   │   ├── routes/            # auth, admin, driver routes
│   │   ├── controllers/
│   │   ├── services/          # business logic, webhook dispatcher
│   │   ├── sockets/           # WebSocket server & event emitters
│   │   └── server.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/                  # Angular + jqwidgets-framework
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/          # Auth guards, interceptors, WebSocket service
│   │   │   ├── admin/         # Admin dashboard, jqxGrid tables, IP blocker, audit logs
│   │   │   ├── driver/        # QR scanner, camera capture, signature pad, GPS
│   │   │   └── shared/        # Shared models and utilities
│   │   ├── angular.json
│   │   └── package.json
└── README.md
```

---

## 8. Instructions for AI Development Agents

When implementing this repository, follow this execution order:
1. **Database First:** Scaffold the `/database` directory with Sqitch (`sqitch.conf`, `sqitch.plan`, and `deploy`/`revert`/`verify` SQL scripts) for all core tables.
2. **Backend Core:** Initialize `/backend` with TypeScript, Express, `pg`, `socket.io`, `multer`, and `jsonwebtoken`. Implement the `manualIpBlock` middleware, `auditLogger` middleware, Auth endpoints, Admin endpoints, and Driver PoD completion endpoint.
3. **Frontend Setup:** Initialize `/frontend` with Angular CLI and install `jqwidgets-ng` / `jqwidgets-framework`. Configure `jqx.base.css` in `angular.json`.
4. **Admin Module:** Build the secure Admin layout using jQWidgets (`jqxGrid` for deliveries/users/audit logs, `jqxNotification` for real-time WebSocket alerts, and manual IP blocking controls).
5. **Driver Module:** Build the mobile-friendly Driver flow: QR Scanner -> Camera Photo Capture -> Signature Canvas -> Geolocation Capture -> Submit.
6. **Verification:** Ensure no automatic IP blocking exists, all DB changes are in Sqitch, and all PoD photos/signatures are protected behind Admin authentication.
