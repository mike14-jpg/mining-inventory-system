# First Quantum Minerals Web Prototype

Frontend-only Inventory Management System prototype for a mining company.

## Project Purpose
This project was developed for an academic Software Engineering course to demonstrate how an Inventory Management System can be designed and implemented as a complete browser-based prototype. The system simulates role-based workflows for mining operations and enables users to manage inventory items such as fuel, tools, spare parts, and equipment without a backend server.

The goal is to present a usable, responsive, and testable interface that reflects practical software engineering concerns including role-based access control, validation, persistence, and user experience.

## Functional Requirements
FR-01: The system shall provide a login page with username and password fields.

FR-02: The system shall support two user roles: Admin and Worker.

FR-03: The system shall authenticate using predefined credentials.

FR-04: The system shall redirect users after login based on role.

FR-05: The system shall persist user session state in localStorage.

FR-06: The system shall display a dashboard with summary cards for total items, low stock items, and category count.

FR-07: The system shall provide inventory listing with item ID, name, quantity, category, and date added.

FR-08: The system shall auto-generate item ID values.

FR-09: The system shall auto-generate date added values.

FR-10: The system shall allow Admin users to add inventory items.

FR-11: The system shall allow Admin users to edit item quantity.

FR-12: The system shall allow Admin users to delete items with confirmation.

FR-13: The system shall restrict Worker users to view-only inventory access.

FR-14: The system shall allow users to search inventory by keyword.

FR-15: The system shall allow users to filter inventory by category.

FR-16: The system shall visually highlight low-stock items.

FR-17: The system shall show success and error messages for user actions.

FR-18: The system shall handle invalid login attempts and invalid form submissions.

FR-19: The system shall recover gracefully from missing or corrupted localStorage data.

FR-20: The system shall support logout and clear user session state.

## Non-Functional Requirements
NFR-01 Usability: The UI shall be intuitive and easy to navigate for non-technical users.

NFR-02 Responsiveness: The UI shall work correctly on mobile, tablet, and desktop screen sizes.

NFR-03 Performance: Common actions (login, filtering, add/edit/delete) shall respond instantly for small to moderate data sizes typical of a prototype.

NFR-04 Reliability: Data shall persist across page refresh using localStorage.

NFR-05 Data Integrity: Input validation shall prevent empty required fields and invalid quantities.

NFR-06 Security (Prototype Scope): Role restrictions shall be enforced in UI logic, while recognizing this is a frontend-only prototype and not production-grade security.

NFR-07 Maintainability: JavaScript logic shall be separated into modules for authentication, dashboard, and inventory behavior.

NFR-08 Compatibility: The application shall run in modern web browsers without requiring backend services.

NFR-09 Readability: Code and project structure shall remain clear enough for academic review and future extension.

NFR-10 Accessibility: Interface controls shall use clear labels, readable contrast, and keyboard-friendly form interactions.

## Tech Stack
- HTML
- Tailwind CSS (utility classes via CDN)
- Vanilla JavaScript
- localStorage for data persistence
- Supabase (optional cloud persistence)

## Project Structure
```
web-version/
  index.html
  dashboard.html
  inventory.html
  js/
    auth.js
    dashboard.js
    inventory.js
```

## Demo Credentials
- Admin: admin / 1234
- Worker: worker / 1234

## JavaScript Function Requirements Covered
- loginUser() in js/auth.js
- addItem() in js/inventory.js
- editItem() in js/inventory.js
- deleteItem() in js/inventory.js
- renderTable() in js/inventory.js

## Run
1. Open a terminal in `web-version`.
2. Start a local static server:
  - `npm start`
  - or `npm run start:py`
3. Open `http://127.0.0.1:5500/index.html` in your browser.
4. Login as admin or worker.
5. Navigate between Dashboard and Inventory pages.

Why this matters: using a local HTTP server avoids browser restrictions and prevents confusion with other services that may already use plain `127.0.0.1` (port 80).

## Supabase Connection Setup
1. Create a Supabase project.
2. In Supabase SQL Editor, run [backend/supabase-schema.sql](backend/supabase-schema.sql).
3. Open [js/supabase-config.js](js/supabase-config.js) and set url and anonKey.
4. Reload the app. The app will use Supabase when config is present.

When Supabase mode is enabled:
- Login uses Supabase Auth email/password.
- Create Account stores the account in `auth.users`.
- A trigger also creates/updates a row in `public.profiles` with email and role.

If Supabase config is left empty, the app automatically falls back to localStorage mode.

## Testing Scenarios
1. Login success (Admin)
2. Login success (Worker)
3. Login failure
4. Add item (Admin)
5. Edit item quantity (Admin)
6. Delete item (Admin)
7. Persistence after refresh
8. Corrupted localStorage recovery
