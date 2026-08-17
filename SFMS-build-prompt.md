# Build Prompt — Stakeholder Feedback Management System (SFMS)

Use this as a single instruction to an AI coding assistant (e.g. Claude Code) to scaffold and build the system. Paste it as-is, or break it into the phase-by-phase sub-prompts at the bottom.

---

## Project Brief

Build a **Stakeholder Feedback Management System (SFMS)** for the Computer Studies Department: a web-based application that collects, manages, analyzes, and reports feedback from stakeholders via QR-code-accessed forms, storing all data in a local MySQL database.

**Target stakeholders:** Students, Alumni, Parents/Guardians, Industry Partners, Internship Supervisors, Employers, Faculty Members, Government Agencies, Community Partners, Accrediting Bodies.

**General objective:** A centralized feedback management platform for efficient collection, processing, analysis, and reporting of stakeholder feedback.

**Specific objectives — the system shall:**
1. Provide QR-code-based access to feedback forms.
2. Allow stakeholders to submit feedback anytime using mobile devices.
3. Categorize feedback according to stakeholder type.
4. Generate statistical reports and analytics.
5. Monitor stakeholder satisfaction levels.
6. Track submitted concerns and recommendations.
7. Export reports for accreditation and quality assurance purposes.
8. Provide administrators with actionable insights.

---

## Tech Stack

- **Backend:** PHP 8.x, Laravel Framework
- **Frontend:** HTML5, CSS3, Bootstrap 5, JavaScript, AJAX, Chart.js
- **Database:** MySQL Community Server 8.0+, managed via phpMyAdmin (local server)
- **QR Codes:** Laravel QR Code generator package
- **Reporting/Export:** DomPDF (PDF), Laravel Excel (Excel/CSV)
- **Architecture:** Stakeholder device → QR scan → Web app (frontend) → HTTP/HTTPS → Application server (PHP/Laravel) → SQL → Local MySQL database

---

## User Roles & Permissions

| Role | Responsibilities |
|---|---|
| **Administrator** | Manage users; create feedback forms; generate QR codes; view/export reports; manage stakeholder categories; manage survey questions |
| **Department Head** | View department reports; view analytics dashboard; monitor satisfaction ratings; export summary reports |
| **Quality Assurance Officer** | View accreditation reports; generate stakeholder assessment reports; export statistical summaries |
| **Stakeholder** | Scan QR code; complete feedback form; submit comments/suggestions — **no login required** |

Implement role-based access control (RBAC) for the first three roles; the Stakeholder flow is fully public/anonymous-capable.

---

## Functional Modules

### Module 1: QR Code Access
- Generate unique QR codes, one per event
- QR code per stakeholder group
- Optional QR code expiration
- QR code usage tracking
- **Inputs:** Event Name, Department, Stakeholder Type, Survey Link
- **Output:** Downloadable QR Code image

### Module 2: Feedback Form Management
- Create dynamic questionnaires with form versioning and scheduling
- Supported question types: Likert Scale (1–5), Multiple Choice, Checkboxes, Text Area, Yes/No, Rating Scale

### Module 3: Feedback Collection
- Mobile-friendly, anonymous-capable submission forms
- Optional respondent info; auto timestamping
- **Captured fields:** Stakeholder Type, Organization, Name (optional), Email (optional), Contact Number (optional), Date Submitted

### Module 4: Satisfaction Survey
- Evaluation areas driven dynamically by the feedback form structure

### Module 5: Feedback Analytics
- Real-time dashboard, satisfaction trend analysis, category-based and comparative reports
- **Metrics:** Overall Satisfaction Rate, Average Rating, Response Count, Recommendation Rate, Stakeholder Participation Rate

### Module 6: Reporting
- **Summary Report:** Total Responses, Satisfaction Score, Recommendations
- **Stakeholder Report:** grouped by Stakeholder Type
- **Event Report:** grouped by Activity/Event
- **Accreditation Report:** meets Quality Assurance requirements
- **Export formats:** PDF, Excel, CSV

### Module 9: Dashboard Analytics (KPIs & Visualizations)
- KPIs: Total Stakeholder Responses, Overall Satisfaction %, Average Rating per Category, Feedback Trend per Month, Most Common Recommendations, Most Frequent Concerns, Stakeholder Participation Distribution
- Visualizations: Pie charts, bar charts, line graphs, heatmaps, word cloud for comments

---

## Non-Functional Requirements

- **Performance:** Response time ≤3s; dashboard load ≤5s; support 200+ concurrent users
- **Reliability:** 99% uptime during office hours; daily database backup
- **Security:** RBAC authentication; password hashing; SQL injection, CSRF, and XSS protection; audit logs (login history, report generation, form modification)
- **Usability:** Responsive, mobile-first design; accessibility compliance
- **Client support:** Android 10+, iOS 15+ (mobile); Chrome, Edge, Firefox (desktop)

---

## Suggested Database Schema (starting point)

```
users (id, name, email, password, role, created_at)
stakeholder_categories (id, name)
events (id, name, department, stakeholder_type, created_by, created_at)
qr_codes (id, event_id, code_string, expires_at, scan_count, created_at)
survey_forms (id, event_id, title, version, status, scheduled_start, scheduled_end)
form_questions (id, form_id, question_text, question_type, order, options_json)
responses (id, form_id, stakeholder_type, organization, name, email, contact_number, submitted_at)
response_answers (id, response_id, question_id, answer_value)
audit_logs (id, user_id, action, description, created_at)
```

---

## Build Order (follow this sequence)

1. **Scaffold Laravel project + auth (Breeze/Jetstream) with RBAC** for Admin, Department Head, QA Officer.
2. **Migrations + models** for the schema above.
3. **Module 2 (Form Management)** — dynamic form builder with all 6 question types, versioning, scheduling.
4. **Module 1 (QR Access)** — generate/download QR per event, link to a form, expiration + scan tracking.
5. **Module 3 (Feedback Collection)** — public, no-login submission page reachable via QR scan; mobile-first Bootstrap layout.
6. **Module 4 & 5 (Satisfaction Survey + Analytics)** — real-time dashboard with Chart.js visualizations against live response data.
7. **Module 6 (Reporting)** — Summary/Stakeholder/Event/Accreditation reports; PDF export via DomPDF, Excel/CSV via Laravel Excel.
8. **Non-functional pass** — enforce CSRF (Laravel default), sanitize inputs (XSS/SQLi via Eloquent + validation), password hashing (Laravel default bcrypt), build audit log middleware, test responsiveness and accessibility (WCAG basics: alt text, contrast, keyboard nav).
9. **Load/performance check** — verify dashboard load and response times under simulated concurrent load.
10. **Cross-device testing** — Android/iOS browsers and Chrome/Edge/Firefox desktop.

---

## Instruction to the AI Assistant

Build this system Laravel-first, module by module in the order above. For each module: create migrations → models → controllers → routes → Blade views (Bootstrap 5) → wire up Chart.js where analytics are involved. Keep the Stakeholder-facing submission flow completely separate from the authenticated Admin/Dept Head/QA routes (no login middleware on public QR-linked routes). After each module, pause and summarize what was built, any assumptions made, and what's needed next before continuing to the following module.
