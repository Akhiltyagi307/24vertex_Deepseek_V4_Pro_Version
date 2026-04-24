# EduAI: AI-POWERED EDUCATIONAL ASSESSMENT PLATFORM
## Comprehensive Product Development Report v3.0

---

## EXECUTIVE SUMMARY

**Project Name:** EduAI - AI-Powered Adaptive Learning Assessment Platform

**Vision:** Build a three-portal, RAG-powered assessment ecosystem that delivers personalized practice tests, adaptive learning pathways, and real-time performance intelligence to students, parents, and teachers across grades 6-12.

**Target Users:**
- **Students (Primary):** Grades 6-12, self-paced practice testing, exam preparation, skill validation
- **Parents:** Real-time visibility into their child's academic performance, assignments, and notifications
- **Teachers:** Class-wide student monitoring, test/assignment creation, grade/section filtering, and multi-channel notification dispatch

**Core Innovation:** Adaptive assessment generation using separated subjects and topics tables, student performance history, topic-level proficiency tracking, and intelligent question generation via Claude AI RAG system, delivered across three purpose-built portals.

**Architecture Shift (v2.2 → v3.0):**
1. **Separated Schema Design** replacing the unified `curriculum_items` self-referencing table with two purpose-built tables: `subjects` (grade-to-subject mapping with stream/elective support) and `topics` (flat curriculum content table storing topic, chapter, unit, grade, and subject references)
2. **Lean Student Profiles** removing all subject data from the `profiles` table; students store only their grade (and for 11-12: stream + 1 elective choice). Subject resolution happens dynamically via the `subjects` table
3. **Stream & Elective System for Grades 11-12** with dedicated `stream` and `elective_subject_id` fields on profiles, and stream-aware subject mapping in the `subjects` table (core subjects per stream + common subjects + elective pool)
4. **Auto-Initialized Performance Tracker** creating `performance_tracker` rows for every topic in a student's resolved subject set immediately upon signup, with status `not_tested`
5. **Three Dedicated Portals** (Student, Parent, Teacher) within a single Next.js 16 application using route groups and role-based middleware
6. **Assignment System** enabling teachers to assign tests and homework to students by grade and section
7. **Multi-Channel Notification Engine** with in-app and email delivery via Resend + React Email
8. **Modern Tech Stack:** Next.js 16 (React 19, Turbopack), Drizzle ORM for type-safe database access, Resend + React Email for transactional email, Motion for animations, Biome for linting/formatting, and Vitest for unit testing

**Time to MVP:** 14-16 weeks | **Full Platform:** 30-34 weeks

**Tech Stack:** Next.js 16 (App Router, React 19, Turbopack), Supabase (PostgreSQL + pgvector + Auth + RLS + Realtime), Drizzle ORM, Vercel AI SDK (including agents / tool-loop orchestration where needed), OpenAI (GPT-5.4 mini via `@ai-sdk/openai`), Tailwind CSS v4, shadcn/ui, Motion, Resend + React Email, Vercel, Redis (Upstash)

---

## 1. PRODUCT VISION & OBJECTIVES

### 1.1 Problem Statement

**Current Market Gaps:**
- Students lack adaptive, personalized practice tests that target weak areas using historical performance data
- Traditional test platforms use generic question banks without learning history context
- No intelligent feedback mechanism that adapts to individual performance patterns
- Parents have zero real-time visibility into their child's practice activity, scores, and learning trajectory
- Teachers lack tools to assign adaptive AI-generated tests to specific grades/sections and monitor outcomes at scale
- Manual performance tracking across multiple subjects creates administrative burden for all stakeholders
- Communication between teachers, students, and parents is fragmented across disconnected channels (WhatsApp groups, email, verbal)
- Assessment quality varies with no intelligent curriculum alignment or quality feedback loops

### 1.2 Solution Overview

A three-portal, RAG-powered ecosystem that:
- **Generates adaptive assessments** based on student performance history and topic proficiency
- **Tracks performance** at granular topic level across multiple subjects using separated subjects and topics tables
- **Provides intelligent feedback** through AI-generated performance reports with strength/weakness analysis
- **Empowers parents** with a dedicated portal to track their child's progress, view reports, check assignments, and receive notifications
- **Equips teachers** with class-wide monitoring, test/assignment creation tools, grade/section filtering, and multi-channel notification dispatch to students and parents
- **Optimizes study time** by focusing on weak areas while avoiding mastered topics
- **Creates engagement** through gamified progress tracking and interactive testing experiences

### 1.3 Key Success Metrics

| Metric | Target | Timeline |
|--------|--------|----------|
| User Registration Conversion | 25%+ | Week 10 |
| Test Completion Rate | 70%+ | Week 14 |
| Performance Report Accuracy | 95%+ | Week 12 |
| Session Duration (Student) | 45-60 min | Week 8 |
| Parent Portal Weekly Engagement | 60%+ of registered parents | Week 16 |
| Teacher Portal Weekly Engagement | 80%+ of registered teachers | Week 18 |
| 30-Day Retention (Student) | 40%+ | Week 16 |
| Student Satisfaction Score | 4.2+/5.0 | Week 14 |
| Teacher Satisfaction Score | 4.5+/5.0 | Week 20 |
| AI Response Latency | <3 seconds | Week 10 |
| Notification Delivery Rate | 99%+ | Week 18 |

### 1.4 Target Audience

**Primary Users:**
- **Students:** Grades 6-12 (ages 11-18)
- **Subject Areas:**
  - *Grades 6-10:* Fixed subjects per grade — Mathematics, Science, English, Hindi, Geography, History, Economics, Political Science (History, Geography, Economics, Political Science grouped under "Social Science" in UI for Grades 9-10)
  - *Grades 11-12:* Stream-based core subjects + 1 elective
    - Science: Physics, Chemistry, Mathematics, Biology, English
    - Commerce: Accountancy, Business Studies, Economics, English
    - Arts: History, Political Science, Geography, Sociology, English
    - Electives (cross-stream): Computer Science, Physical Education, Fine Arts, Home Science, Psychology, etc.
- **Use Case:** Self-paced practice testing, teacher-assigned tests, exam preparation, skill validation

**Secondary Users:**
- **Parents:** Track child's performance, view reports, receive notifications, monitor assignment completion
- **Teachers:** Monitor class performance, assign tests/homework, send notifications, generate class-level analytics

---

## 2. THREE-PORTAL ARCHITECTURE

### 2.1 Portal Overview

```
EduAI Platform (Single Next.js 16 App)
├── Student Portal (/(student)/)
│   ├── Dashboard (personalized learning overview)
│   ├── Practice Test Builder (self-initiated, AI-adaptive)
│   ├── Test Area (interactive test-taking)
│   ├── Performance Reports (post-test analysis)
│   ├── Performance Tracker (topic-level proficiency matrix)
│   ├── Assignments (teacher-assigned work)
│   ├── Notifications (in-app + email)
│   └── Profile & Settings
│
├── Parent Portal (/(parent)/)
│   ├── Child Lookup (enter student ID to link)
│   ├── Performance Dashboard (child's metrics overview)
│   ├── Performance Tracker (read-only, child's topic proficiency)
│   ├── Reports (view child's test reports)
│   ├── Assignments (view child's pending/completed assignments)
│   ├── Notifications (from teachers, system alerts)
│   └── Profile & Settings
│
└── Teacher Portal (/(teacher)/)
    ├── Class Dashboard (all students, filterable by grade/section)
    ├── Student Monitor (individual student deep-dive)
    ├── Test Assignment (configure + assign tests to grade/section)
    ├── Assignment Manager (create, assign, track homework)
    ├── Reports (class-level + individual student reports)
    ├── Notification Center (compose + send to students/parents via email)
    ├── Analytics (class-wide performance trends, at-risk identification)
    └── Profile & Settings
```

### 2.2 Role-Based Access Model

```
AUTHENTICATION & ROLE ROUTING

Signup Flow:
├── Student Signup
│   ├── Email, password, name
│   ├── Grade (dropdown: 6-12)
│   ├── Section (dropdown: A, B, C...)
│   ├── [Grades 11-12 ONLY] Stream selection (Science / Commerce / Arts)
│   ├── [Grades 11-12 ONLY] Elective subject (single-select from available electives)
│   ├── Parent name (required field)
│   ├── Parent email (required field)
│   ├── Role auto-assigned: 'student'
│   └── On signup success:
│       ├── Subjects resolved automatically from `subjects` table (by grade + stream)
│       ├── All topics for resolved subjects fetched from `topics` table
│       └── `performance_tracker` rows created for EVERY topic with status 'not_tested'
│
├── Parent Signup/Linking
│   ├── Parent receives email invitation when student signs up
│   ├── OR: Parent signs up independently and enters Student ID to link
│   ├── Email, password, name
│   ├── Student ID input (UUID or short code)
│   ├── Verification: System confirms student exists and parent email matches
│   └── Role auto-assigned: 'parent'
│
└── Teacher Signup
    ├── Email, password, name
    ├── School/institution name
    ├── Subjects taught (multi-select from `subjects` table, grouped by subject_group where applicable)
    │   └── e.g., A History teacher selects "History" only; a Social Science teacher may select all 4
    ├── Grades taught (multi-select: 6-12)
    ├── Sections assigned (multi-select: A, B, C...)
    ├── Admin approval required (manual verification)
    └── Role auto-assigned: 'teacher'

Post-Auth Routing:
├── role === 'student' → redirect to /(student)/dashboard
├── role === 'parent'  → redirect to /(parent)/dashboard
└── role === 'teacher' → redirect to /(teacher)/dashboard

Middleware Protection:
├── /(student)/* → only role === 'student'
├── /(parent)/*  → only role === 'parent'
├── /(teacher)/* → only role === 'teacher'
└── /api/* → JWT validation + role check per endpoint
```

### 2.3 Next.js 16 Route Group Structure

```
app/
├── (auth)/
│   ├── login/page.tsx
│   ├── signup/
│   │   ├── student/page.tsx
│   │   ├── parent/page.tsx
│   │   └── teacher/page.tsx
│   ├── forgot-password/page.tsx
│   └── layout.tsx (minimal auth layout)
│
├── (student)/
│   ├── layout.tsx (student sidebar, nav, notifications bell)
│   ├── dashboard/page.tsx
│   ├── practice/
│   │   ├── configure/page.tsx (test builder)
│   │   └── [testId]/page.tsx (test area)
│   ├── reports/
│   │   ├── page.tsx (all reports list)
│   │   └── [reportId]/page.tsx (individual report)
│   ├── tracker/page.tsx (performance tracker)
│   ├── assignments/
│   │   ├── page.tsx (list of assignments)
│   │   └── [assignmentId]/page.tsx (take assignment)
│   ├── notifications/page.tsx
│   └── settings/page.tsx
│
├── (parent)/
│   ├── layout.tsx (parent sidebar, notifications bell)
│   ├── link-child/page.tsx (student ID entry + verification)
│   ├── dashboard/page.tsx (child's performance overview)
│   ├── tracker/page.tsx (child's performance tracker, read-only)
│   ├── reports/
│   │   ├── page.tsx (child's reports list)
│   │   └── [reportId]/page.tsx
│   ├── assignments/page.tsx (child's assignment status)
│   ├── notifications/page.tsx
│   └── settings/page.tsx
│
├── (teacher)/
│   ├── layout.tsx (teacher sidebar, notifications bell)
│   ├── dashboard/page.tsx (class overview with filters)
│   ├── students/
│   │   ├── page.tsx (all students, filterable by grade/section)
│   │   └── [studentId]/page.tsx (individual student deep-dive)
│   ├── tests/
│   │   ├── assign/page.tsx (configure + assign test to grade/section)
│   │   └── history/page.tsx (past assigned tests + results)
│   ├── assignments/
│   │   ├── create/page.tsx (create new assignment)
│   │   ├── page.tsx (all assignments, filterable)
│   │   └── [assignmentId]/page.tsx (assignment detail + submissions)
│   ├── reports/page.tsx (class-level analytics)
│   ├── notifications/
│   │   ├── compose/page.tsx (create + send notification)
│   │   └── page.tsx (sent notifications history)
│   ├── analytics/page.tsx (trends, at-risk students)
│   └── settings/page.tsx
│
├── api/
│   ├── auth/
│   ├── tests/
│   ├── assignments/
│   ├── performance/
│   ├── reports/
│   ├── notifications/
│   ├── users/
│   └── ai/
│
├── middleware.ts (role-based route protection)
└── layout.tsx (root layout, providers)
```

---

## 3. DETAILED FEATURE SPECIFICATIONS

### 3.1 Student Portal Features

#### A. Authentication System
```
Feature: Secure User Access Management
Technology: Supabase Auth (JWT-based)

Student Signup Fields:
├── Full name (required)
├── Email (required, validated)
├── Password (min 8 chars, mixed case, numbers)
├── Grade (dropdown: 6-12)
├── Section (dropdown: A, B, C, D, E)
├── [Grades 11-12 ONLY] Stream (radio: Science / Commerce / Arts)
│   └── Conditionally shown when grade 11 or 12 is selected
├── [Grades 11-12 ONLY] Elective Subject (single-select dropdown)
│   └── Options fetched from `subjects` table WHERE grade = selected AND is_elective = TRUE
│   └── Conditionally shown after stream is selected
├── Parent name (required)
├── Parent email (required, validated)
├── Auto-send verification email to student + invitation email to parent
└── Post-Signup Backend Trigger:
    ├── Resolve student's subjects from `subjects` table:
    │   ├── Grades 6-10: All subjects WHERE grade = X AND is_elective = FALSE
    │   └── Grades 11-12: Common core (stream IS NULL, is_elective = FALSE)
    │       + Stream core (stream = chosen_stream, is_elective = FALSE)
    │       + Chosen elective (id = elective_subject_id)
    ├── Fetch all topics from `topics` table for resolved subject IDs + grade
    └── INSERT performance_tracker rows for each topic with status = 'not_tested'

JWT Implementation:
├── Access Token: 1 hour expiration
├── Refresh Token: 7 days expiration
├── Secure HTTP-only cookies for token storage
├── CSRF protection via SameSite attribute
└── Role stored in Supabase Auth user_metadata + profiles table

Session Management:
├── Remember device option (extends refresh to 30 days)
├── Concurrent session limit: 3 devices
├── Session revocation from settings
└── Auto-logout after 2 hours of inactivity
```

#### B. Student Dashboard
```
Feature: Personalized Learning Overview
Display: Real-time performance metrics per subject

Components:
├── Subject Cards (Grid Layout)
│   ├── Subject name with icon
│   ├── Overall performance percentage
│   ├── Tests completed count
│   ├── Last test date
│   ├── Progress bar (visual indicator)
│   ├── Performance status (Good/Satisfactory/Bad)
│   └── Quick action: "Start New Test" button
├── Performance Statistics
│   ├── Total tests completed
│   ├── Average score across all subjects
│   ├── Topics mastered (count)
│   ├── Topics needing improvement (count)
│   ├── Study streak indicator
│   └── Time spent practicing (hours)
├── Pending Assignments Card
│   ├── Count of pending teacher-assigned tests/homework
│   ├── Next deadline with countdown
│   ├── Quick link to assignments page
│   └── Overdue indicator (red badge)
├── Recent Activity Feed
│   ├── Last 5 tests taken (with date, subject, score)
│   ├── Timestamps and duration
│   ├── Quick links to detailed reports
│   └── Performance trends (up/down indicators)
├── Notifications Preview
│   ├── Last 3 unread notifications
│   ├── Source indicator (teacher name, system)
│   └── Quick link to full notifications
└── Analytics Charts
    ├── Performance trend line chart (last 30 days)
    ├── Subject performance comparison bar chart
    ├── Performance distribution (Good/Satisfactory/Bad pie chart)
    └── Study time heatmap (by day/subject)

Data Refresh: Real-time (Supabase Realtime subscriptions)
Cache Strategy: Redis caching with 5-minute invalidation
```

#### C. Practice Test Configuration (Test Builder)
```
Feature: Personalized Test Configuration
UI: Multi-step form with real-time preview

Step 1: Subject & Unit Selection
├── Subject selection (grouped dropdown with icons)
│   ├── Subjects fetched from `subjects` table for student's grade
│   ├── Standalone subjects shown normally (Mathematics, Science, English...)
│   └── Grouped subjects shown under subject_group heading (e.g., "Social Science")
│       ├── Geography
│       ├── History
│       ├── Economics
│       └── Political Science
│   Query: SELECT * FROM subjects
│          WHERE grade = $student_grade AND is_active = TRUE
│          AND id IN (resolved subjects for this student)
│          ORDER BY subject_group NULLS LAST, sort_order, name
├── Display available units for selected subject
│   (queried from `topics` table: SELECT DISTINCT unit_name, unit_number FROM topics WHERE subject_id = $id AND grade = $grade ORDER BY unit_number)
├── Unit description and topic count
└── Next button (validation)

Step 2: Difficulty & time
├── Target difficulty: Easy/Medium/Hard
├── Test duration: **1 hour** or **3 hours** only (student-selectable)
├── Question count and type mix: **derived from duration** (not separately configurable)
│   ├── 1 hour → 15 questions: 5 multiple-choice, 5 fill-in-the-blank, 3 short answer, 2 long answer
│   └── 3 hours → 30 questions: 10 multiple-choice, 10 fill-in-the-blank, 6 short answer, 4 long answer
├── Focus area: Weak Topics / All Topics / Review (topics step; see implementation)
└── Next button

Step 3: Performance Tracker Review (Optional)
├── Display current performance status for each topic under selected unit
├── Color-coded indicators (Good/Satisfactory/Bad/Not Tested)
├── AI recommendation: "We recommend focusing on..."
├── Toggle topics to include/exclude
└── Start Test button

Step 4: Preview & Confirm
├── Test summary (duration, difficulty, topic coverage; question count follows duration rules above)
├── Topics to be covered
├── Performance insights
└── Start Test / Back buttons

AI Configuration Trigger:
├── Pass student_id, selected topic IDs (performance tracker), difficulty, duration
├── AI receives: Student history, weak topics, preferred difficulty; **fixed per-type counts** from duration
├── AI generates questions with answer keys matching the configured type mix
├── Questions stored in session (answer keys never sent to client)
└── Test session initialized with timer
```

#### D. Test Area (Dynamic Testing Interface)
```
Feature: Interactive Test Taking Experience
Layout: Split-screen (Left: Questions, Right: Answer Area)

Left Panel: Question Selection & Progress
├── Question List (Scrollable)
│   ├── Question number badges
│   ├── Visual status indicators:
│   │   ├── Green: Answered
│   │   ├── Yellow: Partially answered
│   │   ├── Gray: Unanswered
│   │   └── Blue: Currently viewing
│   ├── Click to jump to any question
│   └── Color-coded by difficulty/topic
├── Progress Bar
│   ├── Answered: X/20 questions
│   ├── Progress percentage with animation
│   └── Estimated time remaining
└── Timer Display
    ├── Total time allocated
    ├── Time remaining (MM:SS format)
    ├── Visual warning at 10 min remaining (red indicator)
    └── Auto-submit at 0 seconds

Right Panel: Question & Answer Interface
├── Question Display
│   ├── Question number & topic
│   ├── Question text (formatted, supports LaTeX for math via KaTeX)
│   ├── Question difficulty indicator
│   ├── Estimated time to answer
│   └── Question type indicator (MCQ/Short Answer/Numerical)
├── Answer Input (Dynamic based on type)
│   ├── Multiple Choice: Radio buttons (A, B, C, D) with hover highlighting
│   ├── Short Answer: Text area with character counter
│   ├── Numerical: Input with decimal/fraction/unit support
│   └── Auto-save indicator (saves every 10 seconds)
├── Navigation
│   ├── Previous & Next buttons
│   ├── Jump to Question modal
│   ├── Mark for Review toggle
│   └── Save & Continue Later button
└── Submit Section
    ├── Review summary before submit
    ├── Confirmation dialog
    ├── Submit Test button
    └── Save & Exit Draft option

Session Management:
├── Auto-save every 10 seconds to Supabase
├── Session persistence across browser refresh (30-min auto-resume)
├── Graceful handling of lost connection (retry with exponential backoff)
├── Session expires after 2 hours of inactivity
└── LaTeX rendering via KaTeX, code syntax highlighting, responsive layout
```

#### E. Performance Report
```
Feature: Comprehensive Performance Analysis
Display: Post-test detailed report

Report Sections:
1. Test Summary Card
├── Overall Score: X/20 (X%)
├── Performance Status: Good/Satisfactory/Bad
├── Time Taken vs. Time Allocated
├── Accuracy Percentage
├── Average Time per Question
└── Comparison: vs. Your Average (vs. Class Average if teacher-assigned)

2. Question-by-Question Analysis
├── Interactive Table/Accordion
│   ├── Question # | Topic | Your Answer | Correct Answer | Status | Explanation
│   ├── Color coding: Green (Correct), Red (Incorrect), Yellow (Partial)
│   ├── Expandable rows for detailed AI-generated explanation
│   └── Time spent per question
├── Filters: All / Correct / Incorrect / Time-consuming
└── Sort: By topic, difficulty, time, or question number

3. Performance Insights (AI-Generated via Claude)
├── Strengths: Topics where student performed well, encouragement
├── Areas for Improvement: Specific topics, common errors, recommendations
├── Time Management Analysis: Slow questions, quick questions, efficiency tips
└── Difficulty Assessment: Was test appropriate, next test difficulty recommendation

4. Topic Performance Updates
├── Table: Topic | Old Status | New Status | Change
├── Status update logic (Good/Satisfactory/Bad based on score thresholds)
├── Confidence scoring (consistency across tests)
└── Visual performance tracker update preview

5. Action Items & Recommendations
├── Next practice test suggestions with timing
├── Learning resource recommendations
├── Peer comparison (opt-in, privacy-controlled)
└── Download as PDF / Share with Teacher / Email to Parent
```

#### F. Performance Tracker (Progress Monitor)
```
Feature: Topic-Level Proficiency Matrix
Display: Grid/Table showing all subjects and topics

Structure:
├── Header
│   ├── Subject filter (dropdown, grouped by subject_group)
│   │   ├── "All Subjects"
│   │   ├── "Social Science" (meta-filter: shows Geography, History, Economics, Political Science)
│   │   ├── Individual subjects listed for standalone selection
│   │   └── subject_group heading acts as a shortcut to filter all grouped subjects at once
│   ├── Sort options, filter by status, last updated
├── Performance Grid
│   ├── Columns: Topic | Chapter | Unit | Status | Last Test | Trend | Tests Taken
│   ├── Rows: All topics under selected subject (grouped by unit > chapter)
│   ├── Data sourced from `performance_tracker` joined with `topics` and `subjects` tables
│   └── Interactive expand/collapse for unit → chapter grouping
└── Summary Statistics: Total Topics, Mastered, Satisfactory, Needs Improvement, Not Tested

Status Indicators:
├── Good (85%+): Green
├── Satisfactory (70-84%): Yellow
├── Bad (<70%): Red
└── Not Tested: Gray

Interactive Features:
├── Click topic row: View all tests, performance history chart, resources, "Take Practice Test" button
├── Hover: Detailed status, test count, average %, recommendation
└── Bulk actions: Select multiple topics, create targeted practice test
```

#### G. Student Assignments
```
Feature: Teacher-Assigned Work
Display: List of pending and completed assignments

Components:
├── Assignment List
│   ├── Filterable: Pending / Completed / Overdue / All
│   ├── Each card shows: Title, Subject, Due Date, Status, Teacher Name
│   ├── Countdown timer for pending assignments
│   └── Score display for completed assignments
├── Assignment Detail
│   ├── Assignment description and instructions
│   ├── Test configuration (if test-type assignment)
│   ├── Start/Resume button
│   └── Submission status
└── Overdue Handling
    ├── Visual indicator (red badge, strikethrough due date)
    ├── Late submission allowed (configurable by teacher)
    └── Penalty indicator if applicable
```

#### H. Student Notifications
```
Feature: In-App + Email Notification System

Components:
├── Notification Bell (in header, unread count badge)
├── Notification List
│   ├── Source: Teacher name, System
│   ├── Type: Assignment, Test Result, Announcement, Reminder
│   ├── Timestamp (relative: "2 hours ago")
│   ├── Read/Unread status
│   └── Click to navigate to relevant page
├── Email Notifications (via Resend + React Email templates)
│   ├── New assignment notification
│   ├── Assignment deadline reminder (24hr before)
│   ├── Test result available
│   ├── Teacher announcement
│   └── Weekly performance digest
└── Notification Preferences
    ├── Toggle email notifications on/off per type
    ├── Toggle in-app notifications per type
    └── Quiet hours setting
```

---

### 3.2 Parent Portal Features

#### A. Parent Onboarding & Child Linking
```
Feature: Secure Parent-Student Account Linking

Flow Option 1 - Email Invitation (Primary):
├── Student signs up with parent email
├── System sends invitation email to parent with:
│   ├── Platform welcome message
│   ├── Student name and grade info
│   ├── Unique signup link with pre-filled student_id
│   └── Instructions to create parent account
├── Parent clicks link → signup page with student_id pre-filled
├── Parent creates account (email, password, name)
├── System verifies parent email matches student's registered parent_email
└── Link confirmed → parent can view child's data

Flow Option 2 - Manual Linking:
├── Parent signs up independently
├── Navigates to "Link Child" page
├── Enters student's unique Student ID (short code displayed in student settings)
├── System sends verification request to student's email
├── Student confirms linking
└── Parent gets read-only access to child's data

Multi-Child Support:
├── A parent can link multiple children
├── Dashboard shows child selector dropdown
├── Each child's data is isolated
└── Separate notification streams per child

Security:
├── Parent can only view data, never modify student settings or answers
├── Student can revoke parent access from settings
├── All parent access logged in audit trail
└── COPPA/FERPA compliance: Parent consent mechanism for students under 13
```

#### B. Parent Dashboard
```
Feature: Child's Performance Overview (Read-Only)

Components:
├── Child Selector (if multiple children linked)
│   ├── Dropdown with child name, grade, section
│   └── Switch between children
├── Performance Summary Cards
│   ├── Overall average score across all subjects
│   ├── Tests completed (this week / this month)
│   ├── Topics mastered vs. needs improvement
│   ├── Study streak
│   └── Time spent practicing
├── Subject Performance Grid
│   ├── Each subject: Name, Score %, Status indicator, Tests count
│   ├── Click to expand: Unit/chapter/topic breakdown
│   └── Trend arrows (improving/declining/stable)
├── Recent Activity
│   ├── Last 10 tests taken (date, subject, score)
│   ├── Assignment submissions (date, title, status)
│   └── Login activity (last seen timestamp)
├── Assignment Status
│   ├── Pending assignments count with due dates
│   ├── Overdue assignments (red highlight)
│   ├── Completed assignments with scores
│   └── Completion rate percentage
├── Notifications
│   ├── Teacher messages
│   ├── System alerts (declining performance, missed assignments)
│   └── Weekly digest summary
└── Analytics Charts
    ├── Performance trend over time (line chart)
    ├── Subject comparison (bar chart)
    ├── Study time by day (heatmap)
    └── Assignment completion timeline
```

#### C. Parent Performance Tracker (Read-Only)
```
Feature: Child's Topic-Level Proficiency View

Components:
├── Identical layout to student's performance tracker
├── All data read-only (no edit/action capabilities)
├── Subject filter, status filter, sort options
├── Topic-level breakdown with status, trend, tests taken
├── Click topic: View child's test history on that topic
└── Summary statistics panel

Differences from Student View:
├── No "Take Practice Test" button
├── No "Mark as Reviewed" actions
├── Includes "Send Encouragement" button (in-app notification to child)
└── Exportable as PDF for offline review
```

#### D. Parent Reports View
```
Feature: Access to Child's Test Reports

Components:
├── Reports list (all child's completed tests)
├── Filter by subject, date range, status
├── Full report view (identical to student's report view, read-only)
├── Download as PDF
└── No access to answer keys or explanations (configurable by teacher/admin)
```

---

### 3.3 Teacher Portal Features

#### A. Teacher Onboarding
```
Feature: Verified Teacher Account Creation

Signup Fields:
├── Full name
├── Email (institutional email preferred)
├── Password
├── School/Institution name
├── Subjects taught (multi-select)
├── Grades assigned (multi-select: 6-12)
├── Sections assigned (multi-select: A, B, C, D, E)
└── Role: 'teacher'

Verification:
├── Admin approval required before portal access
├── Email verification mandatory
├── Teacher receives approval notification
└── Admin can assign/modify grade-section access later
```

#### B. Teacher Dashboard (Class Overview)
```
Feature: Class-Wide Performance Monitoring

Components:
├── Filter Bar (persistent across all teacher pages)
│   ├── Grade filter (dropdown: 6-12, multi-select)
│   ├── Section filter (dropdown: A-E, multi-select)
│   ├── Subject filter (dropdown, based on teacher's subjects)
│   ├── Date range filter
│   └── Search by student name/email
├── Class Statistics Cards
│   ├── Total students in filtered view
│   ├── Class average score
│   ├── Tests completed (this week)
│   ├── Assignments pending (count)
│   ├── At-risk students count (declining performance)
│   └── Active students (logged in last 7 days)
├── Student Performance Table
│   ├── Columns: Name | Grade | Section | Avg Score | Tests | Last Active | Status | Actions
│   ├── Sortable by any column
│   ├── Status badges: On Track (green), Needs Attention (yellow), At Risk (red)
│   ├── Click row → individual student deep-dive
│   └── Bulk select for assignments/notifications
├── Recent Activity Feed
│   ├── Latest test completions across all students
│   ├── Assignment submissions
│   ├── New student registrations
│   └── Performance milestones
├── Quick Actions
│   ├── Assign New Test (→ test assignment page)
│   ├── Create Assignment (→ assignment creator)
│   ├── Send Notification (→ compose page)
│   └── Export Class Report (CSV/PDF)
└── Analytics Overview
    ├── Class performance trend (line chart)
    ├── Subject performance distribution (bar chart)
    ├── Topic mastery heatmap (topics vs. students)
    └── At-risk student alerts
```

#### C. Student Monitor (Individual Student View)
```
Feature: Deep-Dive into Individual Student Performance

Components:
├── Student Profile Card
│   ├── Name, grade, section, email
│   ├── Account creation date, last active
│   ├── Parent linked (yes/no, parent name)
│   └── Overall performance summary
├── Performance Tracker (Read-Only)
│   ├── Same layout as student's tracker
│   ├── All subjects visible (not just teacher's subjects)
│   ├── Historical trend data
│   └── Export as PDF
├── Test History
│   ├── All tests taken (self-initiated + teacher-assigned)
│   ├── Score, date, duration, subject, type
│   ├── Click to view full report
│   └── Filter by subject, date, type
├── Assignment History
│   ├── All assignments (pending, completed, overdue)
│   ├── Submission timestamps, scores
│   └── Late submission indicators
├── AI Insights Panel
│   ├── Claude-generated summary of student's learning patterns
│   ├── Predicted areas of struggle
│   ├── Recommended intervention actions
│   └── Comparison to class average
└── Quick Actions
    ├── Assign targeted test to this student
    ├── Send notification to student
    ├── Send notification to parent
    └── Download student report
```

#### D. Test Assignment (Teacher-Initiated Tests)
```
Feature: Configure and Assign Tests to Students

Configuration (Similar to Student Test Builder):
├── Step 1: Subject & Unit Selection
│   ├── Subject dropdown (from teacher's assigned subjects, grouped by subject_group)
│   ├── Unit selection from `topics` table (distinct units for selected subject)
│   ├── Chapter/topic selection (optional granularity)
│   └── Next button
├── Step 2: Test Parameters
│   ├── Difficulty: Easy / Medium / Hard / Mixed
│   ├── Question count: 10 / 15 / 20 / 25
│   ├── Duration: 30 / 45 / 60 / 90 minutes
│   ├── Question types: MCQ / Short Answer / Numerical / Mixed
│   └── Next button
├── Step 3: Assign To
│   ├── Grade selection (multi-select from teacher's grades)
│   ├── Section selection (multi-select from teacher's sections)
│   ├── OR: Individual student selection (search + multi-select)
│   ├── Due date & time picker
│   ├── Late submission policy: Allow / Deny / Penalty (% deduction)
│   └── Next button
├── Step 4: Review & Assign
│   ├── Summary: Subject, Unit, 20 questions, Medium, 60 min
│   ├── Assigned to: Grade 9, Sections A & B (45 students)
│   ├── Due: April 20, 2026 at 11:59 PM
│   └── Assign button

Post-Assignment:
├── AI generates question set via Claude (same as student self-test flow)
├── All assigned students receive in-app notification
├── Email sent to all assigned students
├── Email sent to parents of assigned students
├── Assignment appears in student's Assignments tab
├── Teacher can track completion in real-time
└── After due date, teacher can view class-level results
```

#### E. Assignment Manager
```
Feature: Create and Manage Homework Assignments

Assignment Types:
├── Test Assignment (AI-generated adaptive test, graded automatically)
├── Practice Assignment (test without grade impact, for practice)
└── Resource Assignment (reading/video with completion tracking)

Create Assignment:
├── Title and description
├── Type selection
├── Subject, unit, chapter, topic selection (from subjects + topics tables)
├── If test type: Same configuration as Test Assignment above
├── Assign to: Grade/Section/Individual students
├── Due date & time
├── Late submission policy
├── Instructions/notes for students
└── Create button

Assignment Tracking:
├── Dashboard view: All assignments with completion stats
├── Per-assignment view:
│   ├── Student list: Name | Status (Pending/Submitted/Overdue) | Score | Submitted At
│   ├── Completion percentage bar
│   ├── Average score (for test assignments)
│   └── Export results (CSV)
├── Bulk actions: Extend deadline, send reminder, close assignment
└── Automated reminders: 24h before deadline, on overdue
```

#### F. Teacher Notification Center
```
Feature: Multi-Channel Notification Dispatch

Compose Notification:
├── Recipients:
│   ├── Target: Students / Parents / Both
│   ├── Scope: All students / By Grade-Section / Individual students
│   ├── Grade filter (multi-select)
│   ├── Section filter (multi-select)
│   └── Preview: "This will be sent to 45 students and 45 parents"
├── Message:
│   ├── Subject line
│   ├── Body (rich text editor, markdown support)
│   ├── Priority: Normal / Urgent
│   ├── Category: Announcement / Reminder / Alert / General
│   └── Attachments: Links only (no file uploads in v1)
├── Delivery Channels:
│   ├── In-app notification (always, for student recipients)
│   ├── Email to students (toggle, default ON)
│   ├── Email to parents (toggle, default ON for urgent)
│   └── Preview email before sending
└── Send / Schedule for Later

Email Delivery:
├── Sent via Resend transactional API
├── Teacher's name as sender display name
├── Reply-to: Teacher's email (optional)
├── React Email template component (EduAI branded header/footer, responsive)
├── Unsubscribe link (for non-critical emails, managed via Resend suppression list)
└── Delivery tracking (sent, delivered, opened) via Resend webhooks → email_log table

Notification History:
├── All sent notifications with delivery stats
├── Filter by date, type, audience
├── Resend capability
└── View read receipts (in-app only)
```

#### G. Teacher Analytics
```
Feature: Class-Wide Performance Intelligence

Dashboards:
├── Performance Trends
│   ├── Class average over time (line chart, filterable by subject)
│   ├── Performance distribution (histogram)
│   ├── Improvement rate (% of students improving month-over-month)
│   └── Comparison across sections
├── Topic Mastery Matrix
│   ├── Heatmap: Topics (rows) vs. Students (columns)
│   ├── Color: Green (mastered) / Yellow (satisfactory) / Red (struggling)
│   ├── Identify topics where majority of class struggles
│   └── Click cell → student's topic detail
├── At-Risk Student Identification
│   ├── Auto-flagged students with:
│   │   ├── Declining scores (3+ consecutive tests)
│   │   ├── Low engagement (no login in 7+ days)
│   │   ├── Multiple overdue assignments
│   │   └── Performance below 50% in any subject
│   ├── Risk level: High / Medium / Low
│   ├── Quick actions: Send notification, assign targeted test
│   └── AI-generated intervention suggestions
├── Assignment Analytics
│   ├── Completion rates by assignment
│   ├── Average scores by assignment
│   ├── Late submission rates
│   └── Correlation: completion rate vs. performance
└── Export Options
    ├── Class report (PDF)
    ├── Student data (CSV)
    ├── Performance matrix (Excel)
    └── Scheduled reports (weekly email to teacher)
```

---

## 4. TECHNICAL ARCHITECTURE

### 4.1 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                │
├─────────────────────────────────────────────────────────────────────┤
│  Next.js 16 (App Router, Turbopack) + React 19 + TypeScript 5+      │
│  + Tailwind CSS v4                                                   │
│  ├── Route Groups: /(student)/, /(parent)/, /(teacher)/, /(auth)/    │
│  ├── Role-Based Middleware: JWT verification + role routing           │
│  ├── State Management: Zustand v5 (client) + TanStack Query v5       │
│  │   (server state, caching, background refetch)                     │
│  ├── Real-time: Supabase Realtime (WebSockets) for notifications     │
│  ├── UI: shadcn/ui + Radix UI primitives                             │
│  ├── Animations: Motion (smooth page transitions, micro-interactions) │
│  ├── Charts: Recharts                                                 │
│  ├── Forms: React Hook Form v8 + Zod v3 validation                   │
│  ├── Toasts: Sonner                                                   │
│  ├── Math Rendering: KaTeX for LaTeX                                  │
│  └── Data Fetching: Server Actions (mutations) + Route Handlers       │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ HTTPS + WebSocket
┌─────────────────────────────────────────────────────────────────────┐
│                   API LAYER (Next.js Route Handlers + Server Actions) │
├─────────────────────────────────────────────────────────────────────┤
│  Pattern: Server Actions for mutations, Route Handlers for REST API   │
│  ORM: Drizzle ORM — all DB access goes through Drizzle, never raw SQL │
│                                                                        │
│  Endpoint Categories:                                                 │
│  ├── /api/auth/*           → Auth, signup (student/parent/teacher)    │
│  ├── /api/tests/*          → Test generation, submission, retrieval   │
│  ├── /api/assignments/*    → CRUD assignments, submissions, tracking  │
│  ├── /api/ai/*             → Claude API integration, prompt mgmt     │
│  ├── /api/performance/*    → Performance tracking & analytics         │
│  ├── /api/reports/*        → Report generation & retrieval            │
│  ├── /api/notifications/*  → In-app + email notification dispatch     │
│  ├── /api/users/*          → Profiles, preferences, parent linking    │
│  ├── /api/subjects/*        → Subject queries (grade, stream, elective)   │
│  ├── /api/topics/*          → Topic/unit/chapter queries                  │
│                                                                        │
│  Middleware Stack:                                                     │
│  ├── JWT verification + role extraction (@supabase/ssr)               │
│  ├── Role-based endpoint access control                               │
│  ├── Rate limiting (per role: students 50/min, teachers 100/min)      │
│  ├── Input validation (Zod schemas)                                   │
│  ├── Error handling & structured logging                              │
│  └── CORS & security headers                                          │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
┌─────────────────────────────────────────────────────────────────────┐
│                  AI & BUSINESS LOGIC LAYER                            │
├─────────────────────────────────────────────────────────────────────┤
│  Claude AI Integration:                                               │
│  ├── Question Generation Engine (adaptive, performance-aware)         │
│  ├── Performance Analysis Engine (post-test insights)                 │
│  ├── Feedback & Explanation Generator (per-question)                  │
│  ├── Student Pattern Analyzer (for teacher AI insights)               │
│  ├── RAG Context Manager (pgvector similarity search)                 │
│  └── Prompt Orchestration Service (versioned templates)               │
│                                                                        │
│  Services:                                                            │
│  ├── TestGenerationService     (performance-aware question sampling)  │
│  ├── AssignmentService         (CRUD, assignment lifecycle)           │
│  ├── PerformanceTrackerService (status calculation, trend analysis)   │
│  ├── NotificationService       (in-app + email dispatch)              │
│  ├── EmailService              (Resend API + React Email templates)   │
│  ├── ParentLinkingService      (verification, access control)         │
│  ├── AnalyticsService          (aggregation, at-risk detection)       │
│  ├── CacheService              (Redis/Upstash caching layer)          │
│  └── QueueService              (async tasks via BullMQ/Supabase Edge) │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
┌─────────────────────────────────────────────────────────────────────┐
│                     DATA LAYER (Supabase + Drizzle ORM)               │
├─────────────────────────────────────────────────────────────────────┤
│  ORM: Drizzle ORM + drizzle-kit                                       │
│  ├── Schema defined in TypeScript: /src/db/schema/*.ts                │
│  ├── Type-safe queries — no raw SQL in application code               │
│  ├── Migrations managed via drizzle-kit generate + migrate            │
│  └── Drizzle connects to Supabase via DATABASE_URL (direct Postgres)  │
│                                                                        │
│  PostgreSQL Database (Supabase managed):                                                 │
│  ├── profiles (user metadata: role, grade, section, stream, elective)  │
│  ├── subjects (grade-to-subject mapping with stream/elective support)  │
│  ├── topics (flat curriculum content: topic, chapter, unit, grade, subject) │
│  ├── performance_tracker (student x topic proficiency, auto-initialized) │
│  ├── tests (test sessions: self-initiated + teacher-assigned)         │
│  ├── questions (AI-generated, per test session)                       │
│  ├── student_answers (responses + AI feedback)                        │
│  ├── test_reports (AI-generated reports)                              │
│  ├── assignments (teacher-created assignments)                        │
│  ├── assignment_submissions (student submissions)                     │
│  ├── notifications (in-app notification records)                      │
│  ├── parent_student_links (parent-child relationships)                │
│  ├── teacher_assignments (teacher grade/section access)               │
│  ├── user_preferences (notification, difficulty, language prefs)      │
│  └── audit_logs (all sensitive operations)                            │
│                                                                        │
│  Vector Storage (pgvector):                                           │
│  ├── Question embeddings (semantic deduplication)                     │
│  ├── Topic embeddings (similarity matching)                           │
│  └── Performance pattern embeddings (anomaly detection)               │
│                                                                        │
│  Row-Level Security (RLS):                                            │
│  ├── Students: Own data only                                          │
│  ├── Parents: Linked child's data only (read-only)                    │
│  ├── Teachers: Students in assigned grade/section only                │
│  └── All roles: Read subjects + topics (public read)                   │
│                                                                        │
│  Additional Services:                                                 │
│  ├── Supabase Realtime (notification WebSocket subscriptions)         │
│  ├── Supabase Edge Functions (scheduled jobs: reminders, digests)     │
│  ├── pg_cron (scheduled: weekly parent digest, assignment reminders)  │
│  └── Supabase Storage (PDF reports, resources)                        │
│                                                                        │
│  Caching:                                                             │
│  ├── Redis/Upstash (session cache, query cache, rate limiting)        │
│  └── Vercel Edge Network CDN (static assets)                          │
└─────────────────────────────────────────────────────────────────────┘

External Services:
├── Claude AI API (Anthropic)     → Question/report generation
├── Resend + React Email          → Transactional + bulk email with type-safe templates
├── Supabase Storage              → PDF reports, file storage
├── Vercel                        → Deployment, edge functions, CDN
└── Sentry                        → Error tracking & monitoring
```

### 4.2 Database Schema (Detailed)

All tables below have a corresponding Drizzle ORM schema definition in `/src/db/schema/`.
The SQL shown here is the reference spec; Drizzle generates migrations from the TypeScript
schema files via `drizzle-kit generate`. Never write raw SQL queries in application code —
always use Drizzle's query builder or `db.execute()` for raw queries only when absolutely needed.

Drizzle schema files:
```
src/db/
├── index.ts                    ← db client (connects via DATABASE_URL to Supabase Postgres)
├── schema/
│   ├── profiles.ts
│   ├── subjects.ts
│   ├── topics.ts
│   ├── performance-tracker.ts
│   ├── tests.ts
│   ├── questions.ts
│   ├── student-answers.ts
│   ├── test-reports.ts
│   ├── assignments.ts
│   ├── assignment-submissions.ts
│   ├── notifications.ts
│   ├── email-log.ts
│   ├── parent-student-links.ts
│   ├── teacher-assignments.ts
│   ├── user-preferences.ts
│   └── audit-logs.ts
└── migrations/                 ← auto-generated by drizzle-kit
```

```sql
-- ============================================================
-- PROFILES TABLE (extends Supabase Auth)
-- ============================================================
-- Student profiles store ONLY grade, section, and for 11-12: stream + elective.
-- Subjects are NOT stored on the profile — they are resolved dynamically
-- from the `subjects` table based on grade (and stream for 11-12).
--
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(200) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'parent', 'teacher', 'admin')),
    grade INT CHECK (grade BETWEEN 6 AND 12),
    section VARCHAR(5),
    -- Stream selection: ONLY applicable for grades 11-12 students
    -- NULL for grades 6-10 students, parents, and teachers
    stream VARCHAR(50) CHECK (stream IN ('science', 'science_pcmb', 'science_pcm', 'science_pcb', 'commerce', 'commerce_with_maths', 'arts') OR stream IS NULL),
    -- Elective subject: ONLY applicable for grades 11-12 students
    -- References the chosen elective from the subjects table
    elective_subject_id UUID REFERENCES subjects(id),
    school_name VARCHAR(300),
    parent_name VARCHAR(200),        -- filled by students during signup
    parent_email VARCHAR(320),       -- filled by students during signup
    subjects_taught UUID[],          -- for teachers: array of subject IDs from subjects table
    avatar_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE, -- for teachers: admin approval
    last_active_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    -- Ensure stream and elective are only set for 11-12 grade students
    CONSTRAINT stream_grade_check CHECK (
        (grade IN (11, 12) AND role = 'student') OR stream IS NULL
    ),
    CONSTRAINT elective_grade_check CHECK (
        (grade IN (11, 12) AND role = 'student') OR elective_subject_id IS NULL
    ),
    -- Ensure 11-12 students MUST have a stream
    CONSTRAINT stream_required_for_senior CHECK (
        (grade NOT IN (11, 12)) OR (role != 'student') OR (stream IS NOT NULL)
    )
);

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_grade_section ON profiles(grade, section);
CREATE INDEX idx_profiles_stream ON profiles(stream) WHERE stream IS NOT NULL;

-- ============================================================
-- SUBJECTS TABLE (grade-to-subject mapping)
-- ============================================================
-- This table defines WHAT subjects exist for each grade.
-- For grades 6-10: subjects are fixed (all students in a grade study the same subjects).
-- For grades 11-12: subjects are determined by the student's chosen stream,
-- plus common subjects shared across all streams, plus elective options.
--
-- Subject resolution logic (used during signup and throughout the app):
--   Grades 6-10:  SELECT * FROM subjects WHERE grade = X AND is_elective = FALSE
--   Grades 11-12: (common core: stream IS NULL AND is_elective = FALSE)
--                 + (stream core: stream = chosen_stream AND is_elective = FALSE)
--                 + (chosen elective: id = student.elective_subject_id)
--
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(250) NOT NULL,
    grade INT NOT NULL CHECK (grade BETWEEN 6 AND 12),
    -- UI grouping for multi-book subjects (e.g., 'Social Science' for History, Geography etc.)
    -- NULL for standalone subjects (Mathematics, Science, English...)
    subject_group VARCHAR(200) DEFAULT NULL,
    -- Stream mapping: NULL for grades 6-10 (fixed subjects) and for 11-12 common subjects (e.g., English)
    -- Grades 11-12: CBSE-style slugs on subject rows (e.g. science_pcmb, commerce_with_maths); must match profiles.stream
    stream VARCHAR(50) DEFAULT NULL CHECK (stream IN ('science', 'science_pcmb', 'science_pcm', 'science_pcb', 'commerce', 'commerce_with_maths', 'arts') OR stream IS NULL),
    -- Elective flag: TRUE for optional/elective subjects available in grades 11-12
    -- Students choose exactly 1 elective during signup
    is_elective BOOLEAN DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',     -- flexible: icon, color, book_count, etc.
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    -- Ensure stream is only set for grades 11-12
    CONSTRAINT stream_subject_grade_check CHECK (
        grade IN (11, 12) OR (stream IS NULL AND is_elective = FALSE)
    )
);

CREATE INDEX idx_subjects_grade ON subjects(grade);
CREATE INDEX idx_subjects_stream ON subjects(stream) WHERE stream IS NOT NULL;
CREATE INDEX idx_subjects_elective ON subjects(is_elective) WHERE is_elective = TRUE;
CREATE INDEX idx_subjects_group ON subjects(subject_group) WHERE subject_group IS NOT NULL;
CREATE INDEX idx_subjects_grade_stream ON subjects(grade, stream);

-- ============================================================
-- SUBJECTS SEED DATA REFERENCE
-- ============================================================
-- GRADES 6-10 (Fixed subjects — all students study these):
--
-- INSERT INTO subjects (name, grade, subject_group, stream, is_elective, sort_order) VALUES
--   ('Mathematics',       9, NULL,             NULL, FALSE, 1),
--   ('Science',           9, NULL,             NULL, FALSE, 2),
--   ('English',           9, NULL,             NULL, FALSE, 3),
--   ('Hindi',             9, NULL,             NULL, FALSE, 4),
--   ('Geography',         9, 'Social Science', NULL, FALSE, 5),
--   ('History',           9, 'Social Science', NULL, FALSE, 6),
--   ('Economics',         9, 'Social Science', NULL, FALSE, 7),
--   ('Political Science', 9, 'Social Science', NULL, FALSE, 8);
--   -- Repeat for grades 6, 7, 8, 10 with grade-appropriate subjects
--
-- GRADES 11-12 (Stream-based + common + electives):
-- Production seeds use the stream slugs above (PCMB/PCM/PCB, commerce vs commerce_with_maths, arts). Examples below stay compact.
--
-- Common core (all streams):
-- INSERT INTO subjects (name, grade, stream, is_elective, sort_order) VALUES
--   ('English',           11, NULL,       FALSE, 1);
--
-- Science stream core:
-- INSERT INTO subjects (name, grade, stream, is_elective, sort_order) VALUES
--   ('Physics',           11, 'science',  FALSE, 2),
--   ('Chemistry',         11, 'science',  FALSE, 3),
--   ('Mathematics',       11, 'science',  FALSE, 4),
--   ('Biology',           11, 'science',  FALSE, 5);
--
-- Commerce stream core:
-- INSERT INTO subjects (name, grade, stream, is_elective, sort_order) VALUES
--   ('Accountancy',       11, 'commerce', FALSE, 2),
--   ('Business Studies',  11, 'commerce', FALSE, 3),
--   ('Economics',         11, 'commerce', FALSE, 4);
--
-- Arts stream core:
-- INSERT INTO subjects (name, grade, stream, is_elective, sort_order) VALUES
--   ('History',           11, 'arts',     FALSE, 2),
--   ('Political Science', 11, 'arts',     FALSE, 3),
--   ('Geography',         11, 'arts',     FALSE, 4),
--   ('Sociology',         11, 'arts',     FALSE, 5);
--
-- Elective subjects (available to all streams):
-- INSERT INTO subjects (name, grade, stream, is_elective, sort_order) VALUES
--   ('Computer Science',  11, NULL,       TRUE,  10),
--   ('Physical Education',11, NULL,       TRUE,  11),
--   ('Fine Arts',         11, NULL,       TRUE,  12),
--   ('Home Science',      11, NULL,       TRUE,  13),
--   ('Psychology',        11, NULL,       TRUE,  14);
--   -- Repeat same pattern for grade 12

-- Helper function: Get all subjects for a student based on grade + stream + elective
CREATE OR REPLACE FUNCTION get_student_subjects(
    p_grade INT,
    p_stream VARCHAR DEFAULT NULL,
    p_elective_id UUID DEFAULT NULL
)
RETURNS SETOF subjects AS $$
BEGIN
    IF p_grade BETWEEN 6 AND 10 THEN
        -- Grades 6-10: All fixed subjects for that grade
        RETURN QUERY
            SELECT * FROM subjects
            WHERE grade = p_grade AND is_elective = FALSE AND is_active = TRUE
            ORDER BY sort_order, name;
    ELSIF p_grade IN (11, 12) THEN
        -- Grades 11-12: Common core + stream core + chosen elective
        RETURN QUERY
            SELECT * FROM subjects
            WHERE grade = p_grade AND is_active = TRUE
            AND (
                (stream IS NULL AND is_elective = FALSE)       -- common core (e.g., English)
                OR (stream = p_stream AND is_elective = FALSE) -- stream-specific core
                OR (id = p_elective_id)                        -- chosen elective
            )
            ORDER BY sort_order, name;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function: Get available electives for a grade (used in signup form)
CREATE OR REPLACE FUNCTION get_available_electives(p_grade INT)
RETURNS SETOF subjects AS $$
    SELECT * FROM subjects
    WHERE grade = p_grade AND is_elective = TRUE AND is_active = TRUE
    ORDER BY sort_order, name;
$$ LANGUAGE SQL STABLE;

-- Helper function: Get all subjects for a grade (used in teacher signup, admin views)
CREATE OR REPLACE FUNCTION get_all_subjects_for_grade(p_grade INT)
RETURNS SETOF subjects AS $$
    SELECT * FROM subjects
    WHERE grade = p_grade AND is_active = TRUE
    ORDER BY subject_group NULLS LAST, sort_order, name;
$$ LANGUAGE SQL STABLE;

-- ============================================================
-- TOPICS TABLE (flat curriculum content)
-- ============================================================
-- Stores ALL curriculum content in a single flat table.
-- Each row represents one TOPIC with its parent context
-- (which subject, chapter, unit, and grade it belongs to).
--
-- This replaces the self-referencing curriculum_items hierarchy.
-- Units and chapters are stored as attributes (not separate entities),
-- keeping the schema simple while preserving the ability to group/filter
-- by unit and chapter in the UI.
--
-- Example:
--   subject: Mathematics (grade 9)
--     unit: "Number Systems" (unit_number: 1)
--       chapter: "Real Numbers" (chapter_number: 1)
--         topic: "Irrational Numbers" (topic_number: 1)
--         topic: "Rationalizing Denominators" (topic_number: 2)
--       chapter: "Operations on Real Numbers" (chapter_number: 2)
--         topic: "Laws of Exponents" (topic_number: 1)
--
CREATE TABLE topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    grade INT NOT NULL CHECK (grade BETWEEN 6 AND 12),
    -- Unit context
    unit_name VARCHAR(250) NOT NULL,
    unit_number INT NOT NULL,
    -- Chapter context
    chapter_name VARCHAR(250) NOT NULL,
    chapter_number INT NOT NULL,
    -- Topic (the actual granular item tracked in performance_tracker)
    topic_name VARCHAR(250) NOT NULL,
    topic_number INT NOT NULL,
    description TEXT,
    learning_objectives TEXT[],
    metadata JSONB DEFAULT '{}',     -- flexible: estimated_hours, difficulty_hint, etc.
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_topics_subject ON topics(subject_id);
CREATE INDEX idx_topics_grade ON topics(grade);
CREATE INDEX idx_topics_subject_grade ON topics(subject_id, grade);
CREATE INDEX idx_topics_unit ON topics(subject_id, unit_number);
CREATE INDEX idx_topics_chapter ON topics(subject_id, unit_number, chapter_number);

-- Helper function: Get all topics for a subject + grade, ordered by unit > chapter > topic
CREATE OR REPLACE FUNCTION get_topics_for_subject(p_subject_id UUID, p_grade INT)
RETURNS SETOF topics AS $$
    SELECT * FROM topics
    WHERE subject_id = p_subject_id AND grade = p_grade AND is_active = TRUE
    ORDER BY unit_number, chapter_number, topic_number;
$$ LANGUAGE SQL STABLE;

-- Helper function: Get distinct units for a subject + grade (for test builder unit selection)
CREATE OR REPLACE FUNCTION get_units_for_subject(p_subject_id UUID, p_grade INT)
RETURNS TABLE(unit_name VARCHAR, unit_number INT, topic_count BIGINT) AS $$
    SELECT unit_name, unit_number, COUNT(*) as topic_count
    FROM topics
    WHERE subject_id = p_subject_id AND grade = p_grade AND is_active = TRUE
    GROUP BY unit_name, unit_number
    ORDER BY unit_number;
$$ LANGUAGE SQL STABLE;

-- ============================================================
-- TOPICS SEED DATA REFERENCE
-- ============================================================
-- INSERT INTO topics (subject_id, grade, unit_name, unit_number, chapter_name,
--                     chapter_number, topic_name, topic_number) VALUES
--   ($math_9_id, 9, 'Number Systems', 1, 'Real Numbers', 1, 'Irrational Numbers', 1),
--   ($math_9_id, 9, 'Number Systems', 1, 'Real Numbers', 1, 'Rationalizing Denominators', 2),
--   ($math_9_id, 9, 'Number Systems', 1, 'Operations on Real Numbers', 2, 'Laws of Exponents', 1),
--   ($math_9_id, 9, 'Algebra', 2, 'Polynomials', 1, 'Remainder Theorem', 1),
--   ($math_9_id, 9, 'Algebra', 2, 'Polynomials', 1, 'Factorisation of Polynomials', 2),
--   ($math_9_id, 9, 'Algebra', 2, 'Linear Equations in Two Variables', 2, 'Graph of a Linear Equation', 1);

-- ============================================================
-- PARENT-STUDENT LINKING
-- ============================================================
CREATE TABLE parent_student_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
    linked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(parent_id, student_id)
);

CREATE INDEX idx_parent_links_parent ON parent_student_links(parent_id);
CREATE INDEX idx_parent_links_student ON parent_student_links(student_id);

-- ============================================================
-- TEACHER GRADE/SECTION ASSIGNMENTS
-- ============================================================
CREATE TABLE teacher_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    grade INT NOT NULL CHECK (grade BETWEEN 6 AND 12),
    section VARCHAR(5) NOT NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(teacher_id, grade, section, subject_id)
);

CREATE INDEX idx_teacher_assign_teacher ON teacher_assignments(teacher_id);
CREATE INDEX idx_teacher_assign_grade_section ON teacher_assignments(grade, section);

-- ============================================================
-- PERFORMANCE TRACKER
-- ============================================================
-- Rows are auto-created for every topic in a student's resolved subject set
-- immediately upon successful signup. Status starts as 'not_tested'.
--
-- Initialization logic (triggered after student signup):
--   1. Resolve student's subjects via get_student_subjects(grade, stream, elective_id)
--   2. For each subject: SELECT id FROM topics WHERE subject_id = X AND grade = Y
--   3. INSERT INTO performance_tracker (student_id, topic_id, subject_id, status)
--      for each topic with status = 'not_tested'
--
CREATE TABLE performance_tracker (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id),  -- denormalized for fast queries
    status VARCHAR(20) DEFAULT 'not_tested'
        CHECK (status IN ('good', 'satisfactory', 'bad', 'not_tested')),
    last_test_id UUID,
    last_test_date TIMESTAMP,
    average_score DECIMAL(5, 2) CHECK (average_score BETWEEN 0 AND 100),
    tests_taken INT DEFAULT 0 CHECK (tests_taken >= 0),
    confidence_score DECIMAL(3, 2) DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 1),
    trend VARCHAR(20) DEFAULT 'stable' CHECK (trend IN ('improving', 'declining', 'stable')),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, topic_id)
);

CREATE INDEX idx_perf_student_subject ON performance_tracker(student_id, subject_id);
CREATE INDEX idx_perf_status ON performance_tracker(status);
CREATE INDEX idx_perf_student ON performance_tracker(student_id);

-- Helper function: Initialize performance tracker for a new student
-- Called as part of the post-signup flow
CREATE OR REPLACE FUNCTION initialize_performance_tracker(
    p_student_id UUID,
    p_grade INT,
    p_stream VARCHAR DEFAULT NULL,
    p_elective_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO performance_tracker (student_id, topic_id, subject_id, status)
    SELECT
        p_student_id,
        t.id,
        t.subject_id,
        'not_tested'
    FROM topics t
    INNER JOIN get_student_subjects(p_grade, p_stream, p_elective_id) s
        ON t.subject_id = s.id
    WHERE t.grade = p_grade AND t.is_active = TRUE
    ON CONFLICT (student_id, topic_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TEST SESSIONS
-- ============================================================
CREATE TABLE tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id),
    unit_name VARCHAR(250),                -- denormalized from topics table for convenience
    test_type VARCHAR(20) DEFAULT 'self'
        CHECK (test_type IN ('self', 'assigned')),
    assignment_id UUID,  -- FK to assignments table if teacher-assigned
    test_date TIMESTAMP DEFAULT NOW(),
    duration_seconds INT,
    time_limit_seconds INT DEFAULT 3600,
    status VARCHAR(20) DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'submitted', 'graded', 'expired')),
    total_score DECIMAL(5, 2) CHECK (total_score BETWEEN 0 AND 100),
    total_questions INT DEFAULT 20,
    correct_answers INT DEFAULT 0,
    is_draft BOOLEAN DEFAULT FALSE,
    difficulty VARCHAR(10) CHECK (difficulty IN ('easy', 'medium', 'hard', 'mixed')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tests_student ON tests(student_id);
CREATE INDEX idx_tests_status ON tests(status);
CREATE INDEX idx_tests_assignment ON tests(assignment_id);
CREATE INDEX idx_tests_type ON tests(test_type);

-- ============================================================
-- QUESTIONS (AI-generated per test session)
-- ============================================================
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id),
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL
        CHECK (question_type IN (
            'multiple_choice',
            'short_answer',
            'numerical',
            'fill_in_blank',
            'long_answer'
        )),
    difficulty_level VARCHAR(10) CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
    answer_key JSONB NOT NULL,       -- correct answer + explanation (never sent to client)
    options JSONB,                   -- for MCQ: {"A": "...", "B": "...", "C": "...", "D": "..."}
    question_number INT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    embedding vector(1536)           -- for semantic deduplication
);

CREATE INDEX idx_questions_test ON questions(test_id);
CREATE INDEX idx_questions_topic ON questions(topic_id);

-- ============================================================
-- STUDENT ANSWERS
-- ============================================================
CREATE TABLE student_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    student_answer JSONB NOT NULL,
    is_correct BOOLEAN,
    score_earned DECIMAL(5, 2) CHECK (score_earned BETWEEN 0 AND 100),
    ai_feedback TEXT,                -- AI-generated explanation
    time_spent_seconds INT,
    flagged_for_review BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_answers_test ON student_answers(test_id);

-- ============================================================
-- TEST REPORTS (AI-generated)
-- ============================================================
CREATE TABLE test_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE UNIQUE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    summary_report JSONB NOT NULL,
    strengths TEXT[],
    improvement_areas TEXT[],
    ai_insights TEXT,
    topic_performance JSONB,
    recommendations TEXT[],
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ASSIGNMENTS (teacher-created)
-- ============================================================
CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    assignment_type VARCHAR(20) DEFAULT 'test'
        CHECK (assignment_type IN ('test', 'practice', 'resource')),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    unit_name VARCHAR(250),               -- denormalized from topics for convenience
    topic_ids UUID[],                 -- specific topic IDs from topics table
    difficulty VARCHAR(10) CHECK (difficulty IN ('easy', 'medium', 'hard', 'mixed')),
    question_count INT DEFAULT 20,
    time_limit_seconds INT DEFAULT 3600,
    target_grades INT[] NOT NULL,     -- e.g., {9, 10}
    target_sections VARCHAR(5)[] NOT NULL, -- e.g., {'A', 'B'}
    target_student_ids UUID[],        -- for individual assignment (overrides grade/section)
    due_date TIMESTAMP NOT NULL,
    late_submission_policy VARCHAR(20) DEFAULT 'allow'
        CHECK (late_submission_policy IN ('allow', 'deny', 'penalty')),
    late_penalty_percent INT DEFAULT 0 CHECK (late_penalty_percent BETWEEN 0 AND 100),
    instructions TEXT,
    status VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('draft', 'active', 'closed', 'archived')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_assignments_teacher ON assignments(teacher_id);
CREATE INDEX idx_assignments_status ON assignments(status);
CREATE INDEX idx_assignments_due ON assignments(due_date);

-- ============================================================
-- ASSIGNMENT SUBMISSIONS
-- ============================================================
CREATE TABLE assignment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    test_id UUID REFERENCES tests(id),  -- links to the test session
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'submitted', 'graded', 'overdue')),
    score DECIMAL(5, 2),
    submitted_at TIMESTAMP,
    is_late BOOLEAN DEFAULT FALSE,
    penalty_applied DECIMAL(5, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(assignment_id, student_id)
);

CREATE INDEX idx_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX idx_submissions_student ON assignment_submissions(student_id);
CREATE INDEX idx_submissions_status ON assignment_submissions(status);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id),  -- NULL for system notifications
    title VARCHAR(300) NOT NULL,
    body TEXT NOT NULL,
    type VARCHAR(30) NOT NULL
        CHECK (type IN ('assignment', 'test_result', 'announcement', 'reminder',
                        'alert', 'system', 'encouragement')),
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
    category VARCHAR(30),
    reference_type VARCHAR(30),       -- 'assignment', 'test', 'report', etc.
    reference_id UUID,                -- ID of related entity
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notif_recipient ON notifications(recipient_id, is_read);
CREATE INDEX idx_notif_created ON notifications(created_at DESC);

-- ============================================================
-- EMAIL LOG (for delivery tracking)
-- ============================================================
CREATE TABLE email_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_email VARCHAR(320) NOT NULL,
    recipient_id UUID REFERENCES auth.users(id),
    subject VARCHAR(500) NOT NULL,
    template VARCHAR(100),
    status VARCHAR(20) DEFAULT 'queued'
        CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'bounced')),
    provider_message_id VARCHAR(200),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    sent_at TIMESTAMP
);

-- ============================================================
-- LEARNING RESOURCES
-- ============================================================
CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    resource_type VARCHAR(20) CHECK (resource_type IN ('video', 'article', 'worksheet', 'simulation', 'book')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    url VARCHAR(1000) NOT NULL,
    difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    duration_minutes INT,
    source VARCHAR(100),
    rating DECIMAL(3, 2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- USER PREFERENCES
-- ============================================================
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    preferred_difficulty VARCHAR(10) DEFAULT 'medium',
    test_duration_preference INT DEFAULT 3600,
    enable_email_notifications BOOLEAN DEFAULT TRUE,
    enable_inapp_notifications BOOLEAN DEFAULT TRUE,
    notification_types JSONB DEFAULT '{"assignment": true, "test_result": true, "announcement": true, "reminder": true}',
    preferred_language VARCHAR(5) DEFAULT 'en',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    changes JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ROW-LEVEL SECURITY POLICIES
-- ============================================================

-- Subjects: Public read for all authenticated users
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subjects are readable by all authenticated users"
ON subjects FOR SELECT
TO authenticated
USING (true);

-- Topics: Public read for all authenticated users
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Topics are readable by all authenticated users"
ON topics FOR SELECT
TO authenticated
USING (true);

-- Profiles: Users can read own, teachers can read students in their grade/section
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Teachers can view students in their grade/section"
ON profiles FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM profiles tp
        WHERE tp.id = auth.uid()
        AND tp.role = 'teacher'
    )
    AND role = 'student'
    AND EXISTS (
        SELECT 1 FROM teacher_assignments ta
        WHERE ta.teacher_id = auth.uid()
        AND ta.grade = profiles.grade
        AND ta.section = profiles.section
    )
);

CREATE POLICY "Parents can view linked children profiles"
ON profiles FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM parent_student_links psl
        WHERE psl.parent_id = auth.uid()
        AND psl.student_id = profiles.id
        AND psl.status = 'active'
    )
);

-- Performance tracker: Students own data, parents linked child, teachers their students
ALTER TABLE performance_tracker ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view own performance"
ON performance_tracker FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students update own performance"
ON performance_tracker FOR ALL USING (auth.uid() = student_id);

CREATE POLICY "Parents view linked child performance"
ON performance_tracker FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM parent_student_links psl
        WHERE psl.parent_id = auth.uid()
        AND psl.student_id = performance_tracker.student_id
        AND psl.status = 'active'
    )
);

CREATE POLICY "Teachers view students in their grade/section"
ON performance_tracker FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN teacher_assignments ta ON ta.teacher_id = auth.uid()
            AND ta.grade = p.grade AND ta.section = p.section
        WHERE p.id = performance_tracker.student_id
    )
);

-- Tests: Similar pattern
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view own tests"
ON tests FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students manage own tests"
ON tests FOR ALL USING (auth.uid() = student_id);

CREATE POLICY "Parents view linked child tests"
ON tests FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM parent_student_links psl
        WHERE psl.parent_id = auth.uid()
        AND psl.student_id = tests.student_id
        AND psl.status = 'active'
    )
);

CREATE POLICY "Teachers view their students tests"
ON tests FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN teacher_assignments ta ON ta.teacher_id = auth.uid()
            AND ta.grade = p.grade AND ta.section = p.section
        WHERE p.id = tests.student_id
    )
);

-- Notifications: Recipients only
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications"
ON notifications FOR SELECT USING (auth.uid() = recipient_id);

CREATE POLICY "Users update own notifications"
ON notifications FOR UPDATE USING (auth.uid() = recipient_id);

CREATE POLICY "Teachers can insert notifications"
ON notifications FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher'
    )
);

-- Assignments: Teachers manage, students view if assigned to their grade/section
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage own assignments"
ON assignments FOR ALL USING (auth.uid() = teacher_id);

CREATE POLICY "Students view assignments for their grade/section"
ON assignments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'student'
        AND p.grade = ANY(assignments.target_grades)
        AND p.section = ANY(assignments.target_sections)
    )
    OR auth.uid() = ANY(assignments.target_student_ids)
);

CREATE POLICY "Parents view child assignments"
ON assignments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM parent_student_links psl
        JOIN profiles p ON p.id = psl.student_id
        WHERE psl.parent_id = auth.uid()
        AND psl.status = 'active'
        AND (p.grade = ANY(assignments.target_grades) AND p.section = ANY(assignments.target_sections))
    )
);
```

### 4.3 Claude AI Integration (RAG Architecture)

```
PROMPT ENGINEERING FOR QUESTION GENERATION

System Prompt (Role Definition):
┌──────────────────────────────────────────────────────────────┐
│ You are an expert educator and assessment specialist.         │
│ Your role is to generate high-quality, adaptive practice      │
│ questions for K-12 students at various levels.                │
│                                                                │
│ Requirements:                                                 │
│ - Generate exactly {question_count} questions                │
│ - Focus on topics where the student needs improvement        │
│ - Ensure pedagogical accuracy and clarity                    │
│ - Provide comprehensive answer keys with step-by-step        │
│   explanations                                                │
│ - Adapt difficulty based on student performance              │
│ - Include the required mix (MC, fill-in-the-blank, short, long) per duration │
│ - Avoid ambiguity in questions and correct answers           │
│ - Align with grade {grade_level} curriculum standards        │
│                                                                │
│ Response format: JSON (structured output)                    │
└──────────────────────────────────────────────────────────────┘

Dynamic Context (Retrieval-Augmented):
┌──────────────────────────────────────────────────────────────┐
│ Curriculum Context (from subjects + topics tables):            │
│ {                                                             │
│   "subject": "Mathematics",                                   │
│   "unit": "Algebra - Functions",                              │
│   "topics": [                                                 │
│     { "name": "Linear Functions", "id": "uuid-1" },          │
│     { "name": "Quadratic Functions", "id": "uuid-2" },       │
│     { "name": "Polynomial Functions", "id": "uuid-3" }       │
│   ]                                                           │
│ }                                                             │
│                                                                │
│ Performance Data:                                             │
│ {                                                             │
│   "student_id": "uuid",                                       │
│   "grade_level": 9,                                           │
│   "performance_history": [                                    │
│     {                                                          │
│       "topic_id": "uuid-1",                                    │
│       "topic": "Linear Functions",                            │
│       "status": "satisfactory",                               │
│       "avg_score": 72,                                        │
│       "tests_taken": 3,                                       │
│       "trend": "improving"                                    │
│     },                                                         │
│     {                                                          │
│       "topic_id": "uuid-2",                                    │
│       "topic": "Quadratic Functions",                         │
│       "status": "bad",                                        │
│       "avg_score": 58,                                        │
│       "tests_taken": 2,                                       │
│       "trend": "stable"                                       │
│     }                                                          │
│   ],                                                           │
│   "weak_topics": ["Quadratic Functions"],                     │
│   "satisfactory_topics": ["Linear Functions"],                │
│   "strong_topics": ["Polynomial Functions"],                  │
│   "preferred_difficulty": "medium"                            │
│ }                                                              │
│                                                                │
│ Topic Focus Weights:                                         │
│ - Quadratic Functions: HIGH (40%)                            │
│ - Linear Functions: MEDIUM (30%)                             │
│ - Polynomial Functions: LOW (30%)                            │
└──────────────────────────────────────────────────────────────┘

Expected JSON Output Structure:
{
  "questions": [
    {
      "question_number": 1,
      "topic_id": "uuid-2",
      "topic_name": "Quadratic Functions",
      "question_text": "...",
      "question_type": "multiple_choice | fill_in_blank | short_answer | long_answer",
      "difficulty_level": "medium",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "answer_key": {
        "correct_answer": "B",
        "explanation": "Step-by-step solution...",
        "common_mistakes": ["Forgetting to factor...", "Sign error..."],
        "related_concept": "Factoring quadratics"
      },
      "estimated_time_seconds": 120
    }
  ],
  "generation_metadata": {
    "topic_distribution": { ... },
    "difficulty_distribution": { ... },
    "type_distribution": { ... },
    "adaptation_rationale": "..."
  }
}

PROMPT FOR PERFORMANCE REPORT GENERATION:
- Same structure as v1, enhanced with:
  - Class comparison data (if teacher-assigned test)
  - Parent-friendly summary (simplified language for parent portal)
  - Teacher action items (intervention suggestions for teacher portal)

Error Handling & Validation:
├── Validate JSON structure from Claude response
├── Retry mechanism with exponential backoff (max 3 retries)
├── Timeout handling (max 45 seconds per request)
├── Fallback: Serve from cached question bank if generation fails
└── Quality validation: Check question count, types, topic coverage
```

### 4.4 API Endpoints Reference

```
AUTHENTICATION ENDPOINTS
POST   /api/auth/signup/student    → { email, password, name, grade, section, stream?, elective_subject_id?, parent_name, parent_email }
                                      Grades 6-10: stream and elective_subject_id are omitted
                                      Grades 11-12: stream (required), elective_subject_id (optional)
                                      Post-signup: auto-resolves subjects → initializes performance_tracker
POST   /api/auth/signup/parent     → { email, password, name, student_id }
POST   /api/auth/signup/teacher    → { email, password, name, school, subjects, grades, sections }
POST   /api/auth/signin            → { email, password } → { user, token, role }
POST   /api/auth/refresh           → { refresh_token }
POST   /api/auth/forgot-password   → { email }
POST   /api/auth/reset-password    → { token, new_password }

SUBJECTS & TOPICS ENDPOINTS
GET    /api/subjects                → { subjects } (filtered by grade, stream, is_elective)
                                       Query: ?grade=9 returns all fixed subjects for grade 9
                                       Query: ?grade=11&stream=science_pcm returns common core + matching stream core (slug must match subjects.stream)
                                       Response includes subject_group field for UI grouping
GET    /api/subjects/electives      → { electives } (available elective subjects for a grade)
                                       Query: ?grade=11 returns all elective options
GET    /api/subjects/student        → { subjects } (resolved subjects for current student based on profile)
GET    /api/topics                  → { topics } (filtered by subject_id, grade)
                                       Query: ?subject_id=X&grade=9 returns all topics grouped by unit/chapter
GET    /api/topics/units            → { units } (distinct units for a subject + grade)
                                       Query: ?subject_id=X&grade=9 returns unit names + topic counts

TEST ENDPOINTS
POST   /api/tests/generate          → { subject_id, unit_name?, topic_ids, difficulty, question_count, focus_type }
                                       Auth: student, teacher
GET    /api/tests/:testId           → { test_data, questions (no answer keys for students) }
POST   /api/tests/:testId/submit    → { answers: [{ question_id, answer }] }
GET    /api/tests/:testId/report    → { report } (generates via Claude if not cached)
PATCH  /api/tests/:testId/save      → { answers (partial) } (auto-save)

PERFORMANCE ENDPOINTS
GET    /api/performance/tracker     → { performance_matrix, summary }
                                       Query: ?subject_id=X, ?student_id=X (teacher/parent)
GET    /api/performance/trends      → { trend_data } Query: ?student_id, ?subject_id, ?days=30

ASSIGNMENT ENDPOINTS (Teacher)
POST   /api/assignments             → { title, type, subject_id, ... }
GET    /api/assignments             → { assignments } (filtered by role)
GET    /api/assignments/:id         → { assignment, submissions }
PATCH  /api/assignments/:id         → { updates }
DELETE /api/assignments/:id
POST   /api/assignments/:id/remind  → send reminder notifications

ASSIGNMENT ENDPOINTS (Student)
GET    /api/assignments/mine        → { assignments } (for student's grade/section)
POST   /api/assignments/:id/start   → { test_id } (creates test session for assignment)
POST   /api/assignments/:id/submit  → { submission }

NOTIFICATION ENDPOINTS
GET    /api/notifications           → { notifications } (for current user, paginated)
PATCH  /api/notifications/:id/read  → mark as read
POST   /api/notifications/send      → { recipients, title, body, channels }
                                       Auth: teacher only
GET    /api/notifications/unread-count → { count }

PARENT ENDPOINTS
POST   /api/parent/link-child       → { student_id } → verification flow
GET    /api/parent/children         → { linked_children }
GET    /api/parent/child/:studentId/dashboard → { performance_summary }
GET    /api/parent/child/:studentId/tracker   → { performance_matrix }
GET    /api/parent/child/:studentId/reports   → { reports }
GET    /api/parent/child/:studentId/assignments → { assignments }

TEACHER ENDPOINTS
GET    /api/teacher/students        → { students } Query: ?grade, ?section, ?search
GET    /api/teacher/students/:id    → { student_detail, performance, tests, assignments }
GET    /api/teacher/analytics       → { class_stats, trends, at_risk }
POST   /api/teacher/tests/assign    → { config, target_grades, target_sections, due_date }
GET    /api/teacher/tests/assigned  → { assigned_tests, completion_stats }

DASHBOARD ENDPOINTS
GET    /api/dashboard/student       → { subjects, performance, recent_tests, assignments, notifications }
GET    /api/dashboard/parent        → { child_summary, recent_activity, assignments, notifications }
GET    /api/dashboard/teacher       → { class_stats, recent_activity, pending_assignments }

USER ENDPOINTS
GET    /api/users/profile           → { profile, preferences }
PUT    /api/users/profile           → { updates }
PUT    /api/users/preferences       → { preference_updates }
```

### 4.5 Notification & Email Architecture

```
NOTIFICATION FLOW

Teacher sends notification:
┌────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Teacher    │────→│  API Route   │────→│ NotificationSvc  │
│  Compose    │     │ /api/notif/  │     │                  │
│  Form       │     │ send         │     │ 1. Resolve       │
└────────────┘     └──────────────┘     │    recipients    │
                                         │ 2. Batch insert  │
                                         │    notifications │
                                         │ 3. Queue emails  │
                                         └───────┬──────────┘
                                                 │
                              ┌───────────────────┼───────────────────┐
                              │                   │                   │
                    ┌─────────▼────────┐ ┌───────▼────────┐ ┌───────▼────────┐
                    │ Supabase         │ │ Email Queue    │ │ Supabase       │
                    │ notifications    │ │ (BullMQ or     │ │ Realtime       │
                    │ table INSERT     │ │  Edge Function)│ │ broadcast      │
                    │                  │ │                │ │                │
                    │ In-app notif     │ │ Resend API     │ │ WebSocket push │
                    │ stored           │ │ calls          │ │ to online users│
                    └──────────────────┘ └────────────────┘ └────────────────┘

Recipient Resolution Logic:
├── Input: { target: 'both', grades: [9], sections: ['A', 'B'] }
├── Step 1: Query students → SELECT id, email FROM profiles WHERE grade IN (9) AND section IN ('A','B')
├── Step 2: Query parents → SELECT p.id, p.email FROM profiles p
│           JOIN parent_student_links psl ON psl.parent_id = p.id
│           JOIN profiles s ON s.id = psl.student_id
│           WHERE s.grade IN (9) AND s.section IN ('A','B') AND psl.status = 'active'
├── Step 3: Batch insert into notifications table (one row per recipient)
└── Step 4: Queue email jobs for all recipients with email enabled

Email Templates (via Resend + React Email):
├── All templates are React components in /src/emails/*.tsx
├── welcome_student      → Student signup confirmation
├── parent_invitation    → Invite parent to create account
├── parent_link_confirm  → Child linking confirmation
├── assignment_new       → New assignment notification
├── assignment_reminder  → 24hr before deadline
├── test_result          → Test graded, view report
├── teacher_announcement → General announcement
├── weekly_digest_parent → Weekly summary of child's activity
└── weekly_digest_student → Weekly performance summary

Scheduled Jobs (via Supabase Edge Functions + pg_cron):
├── Every 24h: Check for assignments due tomorrow → send reminders
├── Every 24h: Check for overdue assignments → update status, notify teacher
├── Every Sunday: Generate parent weekly digest → queue emails
├── Every Sunday: Generate student weekly digest → queue emails
└── Every 1h: Process email queue → send via Resend API
```

---

## 5. PHASED DEVELOPMENT ROADMAP

### Phase 1: MVP - Student Portal Core (Weeks 1-14)

**Objective:** Launch student portal with full test-taking, performance tracking, and reporting flow.

#### Sprint 1-2: Foundation & Setup (Weeks 1-2)
```
Tasks:
├── Project Setup
│   ├── Next.js 16 project initialization (App Router, TypeScript 5+, Turbopack)
│   ├── Supabase project setup
│   ├── Drizzle ORM setup (drizzle-kit, DATABASE_URL pointing to Supabase Postgres)
│   ├── Subjects + Topics schema in Drizzle (includes stream/elective support)
│   ├── Profiles schema in Drizzle (with stream, elective_subject_id) + first migration run
│   ├── Environment configuration (.env.local)
│   ├── CI/CD pipeline (GitHub Actions → Vercel)
│   └── Seed curriculum data (2-3 subjects with full topic hierarchy)
│       Seed note: Include Geography + History with subject_group='Social Science'
│       to validate grouped dropdown UI. Include 11-12 stream subjects to validate stream logic
├── Authentication System
│   ├── Supabase Auth integration
│   ├── Student signup flow (with stream/elective for 11-12, parent email collection)
│   │   └── Post-signup trigger: resolve subjects → initialize performance_tracker
│   ├── Login page (shared for all roles, post-auth role routing)
│   ├── Forgot password flow
│   ├── JWT token management + refresh
│   ├── Role-based middleware (/(student)/ routes protected)
│   └── Profiles table auto-population via Supabase trigger
├── Design System
│   ├── Tailwind CSS + shadcn/ui setup
│   ├── Component library foundation
│   ├── Student portal layout (sidebar, header, content area)
│   └── Responsive design framework
└── Route Group Structure
    ├── /(auth)/ layout and pages
    ├── /(student)/ layout with sidebar navigation
    └── Placeholder pages for all student routes

Deliverables:
- Deployed Next.js app on Vercel
- Student auth working (signup/login/forgot password)
- Subjects + Topics tables live with seed data
- Performance tracker auto-initialization working on signup
- Route groups and middleware operational
- Component library ready

Acceptance Criteria:
✓ Student can signup (grade 6-10: no stream needed; grade 11-12: stream + elective required)
✓ Subjects auto-resolved from subjects table based on grade/stream
✓ Performance tracker rows created for all topics on signup with status 'not_tested'
✓ Subject dropdown renders grouped UI (Social Science group visible)
✓ JWT tokens correctly issued with role
✓ Database schema initialized with subjects + topics seed data
✓ Role-based routing works (student → student portal)
✓ All pages responsive
```

#### Sprint 3-4: Dashboard & Performance Tracker (Weeks 3-4)
```
Tasks:
├── Student Dashboard
│   ├── Subject cards with performance data
│   ├── Performance statistics panel
│   ├── Recent activity feed
│   ├── Analytics charts (Recharts)
│   └── Real-time updates (Supabase Realtime)
├── Performance Tracker
│   ├── Topic/unit grid layout using topics table joined with subjects
│   ├── Status indicators (color-coded)
│   ├── Trend visualization
│   ├── Interactive expand/collapse (unit → chapter → topic)
│   ├── Filter & sort functionality
│   └── Summary statistics panel
├── Backend
│   ├── Dashboard data aggregation API
│   ├── Performance tracker API with subjects + topics joins
│   ├── Performance calculation algorithms
│   ├── Redis caching layer (Upstash)
│   └── RLS policies for student data
└── Testing
    ├── Unit tests (Jest)
    ├── Integration tests for API routes
    └── E2E tests (Playwright)

Deliverables:
- Functional student dashboard
- Performance tracker with subjects + topics hierarchy
- API endpoints tested

Acceptance Criteria:
✓ Dashboard loads performance data correctly
✓ Performance tracker displays topic hierarchy (subject → unit → chapter → topic)
✓ Status calculations match business logic
✓ Response time <500ms
```

#### Sprint 5-6: Test Builder & Claude Integration (Weeks 5-6)
```
Tasks:
├── Test Configuration UI (Multi-step Form)
│   ├── Subject & unit selection (from subjects + topics tables)
│   ├── Difficulty, duration (question counts fixed by duration in self-practice)
│   ├── Topic selection with performance preview
│   ├── Preview & confirm step
│   └── React Hook Form + Zod validation
├── Claude AI Integration
│   ├── Anthropic API setup
│   ├── Prompt engineering (question generation templates)
│   ├── Performance data context preparation
│   ├── Question generation service
│   ├── JSON response parsing & validation
│   ├── Error handling, retry, fallback
│   └── Streaming response for UX
├── Test Session Management
│   ├── Test creation & session initialization
│   ├── Question storage (answer keys encrypted, never sent to client)
│   ├── Time tracking
│   └── Auto-save functionality
└── Testing: E2E flow, Claude mock tests, error scenarios

Deliverables:
- Complete test builder form
- Claude question generation working
- Test sessions created & stored

Acceptance Criteria:
✓ Form validation works
✓ Claude generates correct question count & types
✓ Questions match performance focus areas
✓ 95%+ generation success rate
```

#### Sprint 7-8: Test Area (Interactive Testing) (Weeks 7-8)
```
Tasks:
├── Test Interface UI
│   ├── Split-screen layout
│   ├── Question selection panel with status indicators
│   ├── Timer with countdown & warnings
│   ├── Answer inputs (MCQ, short answer, numerical)
│   ├── LaTeX rendering (KaTeX)
│   ├── Navigation & question jumping
│   └── Responsive design
├── Interactive Features
│   ├── Auto-save every 10 seconds
│   ├── Session persistence across refresh
│   ├── Draft save & resume
│   ├── Mark for review
│   └── Browser tab warning
├── Test Submission
│   ├── Pre-submit validation & review
│   ├── Confirmation dialog
│   ├── Submit API call
│   └── Redirect to report
└── Testing: E2E test-taking, timer accuracy, edge cases

Deliverables:
- Fully functional test-taking interface
- Auto-save & session persistence
- Edge cases handled

Acceptance Criteria:
✓ All question types answerable
✓ Auto-save works every 10 seconds
✓ Timer accurate within 1 second
✓ Resume draft works
✓ Submit flow complete
```

#### Sprint 9-10: Reports, Grading & Performance Updates (Weeks 9-10)
```
Tasks:
├── Test Grading Service
│   ├── Automatic grading (MCQ instant, SA/numerical via Claude)
│   ├── Partial credit handling
│   ├── Score calculation
│   └── Topic-wise breakdown
├── Report Generation (Claude AI)
│   ├── Performance analysis prompt
│   ├── Strengths/weaknesses identification
│   ├── Personalized recommendations
│   ├── Response parsing & storage in test_reports
│   └── PDF export
├── Report UI
│   ├── Summary card, question-by-question analysis
│   ├── Performance insights section
│   ├── Topic performance updates
│   └── Download as PDF
├── Performance Tracker Updates
│   ├── Status recalculation after each test
│   ├── Trend analysis (improving/declining/stable)
│   ├── Confidence scoring
│   └── Notification on status change
└── Testing: Grading accuracy, report generation, integration

Deliverables:
- Automatic grading system
- AI-generated performance reports
- Performance tracker auto-updates
- Student portal MVP complete

Acceptance Criteria:
✓ Grading accuracy: 100% for MCQ
✓ Report generation: <15 seconds
✓ Performance tracker correctly updated post-test
✓ PDF download working
```

#### Sprint 11-12: Student Notifications & Polish (Weeks 11-12)
```
Tasks:
├── Notification System (Student Side)
│   ├── notifications table + RLS policies
│   ├── Notification bell component (unread count)
│   ├── Notification list page
│   ├── Supabase Realtime subscription for live updates
│   ├── Mark as read functionality
│   └── Notification preferences in settings
├── Email Integration
│   ├── Resend account setup + API key configuration
│   ├── React Email setup (/src/emails/*.tsx templates)
│   ├── Student welcome email template (React Email component)
│   ├── Parent invitation email template (React Email component)
│   ├── Test result notification email (React Email component)
│   └── Email delivery logging (email_log table)
├── Profile & Settings
│   ├── Profile editing (name, grade, section, stream/elective for 11-12)
│   ├── Password change
│   ├── Notification preferences
│   ├── Student ID display (for parent linking)
│   └── Account deletion
├── Polish & Bug Fixes
│   ├── Performance optimization
│   ├── Loading states & error handling
│   ├── Empty states for new users
│   └── Mobile responsiveness audit
└── Testing: Full E2E student journey, load testing

Deliverables:
- Notification system operational
- Email integration working
- Student portal fully polished
```

#### Sprint 13-14: Beta Testing & Stabilization (Weeks 13-14)
```
Tasks:
├── Beta Testing
│   ├── Recruit 100-200 beta students
│   ├── Seed 5+ subjects with full topic hierarchy
│   │   └── Include all 4 Social Science subjects for Grade 9-10 (Geography, History,
│   │       Economics, Political Science) to validate grouped subject UI end-to-end
│   │       Include Grade 11 Science stream subjects to validate stream-based resolution
│   ├── Monitor performance, errors, UX issues
│   ├── Collect feedback (in-app survey)
│   └── Fix critical bugs
├── Performance Optimization
│   ├── Database query optimization
│   ├── Redis caching tuning
│   ├── API response time audit (<2s p95)
│   ├── Core Web Vitals optimization
│   └── Claude API latency optimization
├── Security Audit
│   ├── RLS policy review
│   ├── JWT token security
│   ├── Input validation audit
│   └── OWASP top 10 checklist
└── Documentation
    ├── API documentation (OpenAPI)
    ├── Database schema documentation
    └── Deployment guide

Deliverables:
- Student portal beta-tested and stable
- Performance targets met
- Security audit passed
- Ready for Phase 2

Phase 1 Summary:
✓ Student portal fully operational
✓ Subjects + topics schema working with stream/elective support
✓ AI-adaptive test generation
✓ Performance tracking at topic level
✓ AI-generated reports
✓ Notification + email foundation
✓ Beta-tested with 100-200 students
```

---

### Phase 2: Parent Portal & Teacher Portal Core (Weeks 15-24)

**Objective:** Launch parent portal and teacher portal with core features.

#### Sprint 15-16: Parent Portal (Weeks 15-16)
```
Tasks:
├── Parent Authentication
│   ├── Parent signup page
│   ├── Email invitation flow (triggered by student signup)
│   ├── Parent role assignment in profiles
│   ├── /(parent)/ route group + layout
│   └── Parent middleware protection
├── Parent-Student Linking
│   ├── parent_student_links table + RLS
│   ├── Link via invitation email (pre-filled student_id)
│   ├── Link via manual Student ID entry
│   ├── Verification flow (email match or student confirmation)
│   ├── Multi-child support
│   └── Revoke access capability (student settings)
├── Parent Dashboard
│   ├── Child selector (if multiple children)
│   ├── Performance summary cards (read-only)
│   ├── Subject performance grid
│   ├── Recent activity feed
│   ├── Assignment status view
│   └── Analytics charts
├── Parent Performance Tracker (Read-Only)
│   ├── Same UI as student tracker, read-only mode
│   ├── RLS: parent sees only linked child data
│   └── Export as PDF
├── Parent Reports View
│   ├── List of child's test reports
│   ├── Full report view (read-only)
│   └── PDF download
├── Parent Notifications
│   ├── Notification list (from teachers, system)
│   ├── Email notifications (assignment alerts, weekly digest)
│   └── Notification preferences
└── Testing: Full parent journey E2E, linking flow, RLS validation

Deliverables:
- Parent portal fully functional
- Parent-student linking working
- Read-only access to child's data verified

Acceptance Criteria:
✓ Parent can sign up and link to child
✓ Dashboard shows correct child data
✓ RLS prevents access to unlinked students
✓ Email invitation flow works
✓ Multi-child switching works
```

#### Sprint 17-18: Teacher Portal - Dashboard & Monitoring (Weeks 17-18)
```
Tasks:
├── Teacher Authentication
│   ├── Teacher signup page (with admin approval gate)
│   ├── teacher_assignments table + seeding
│   ├── /(teacher)/ route group + layout
│   └── Teacher middleware protection
├── Teacher Dashboard
│   ├── Filter bar (grade, section, subject, date range, search)
│   ├── Class statistics cards
│   ├── Student performance table (sortable, filterable)
│   ├── Recent activity feed
│   ├── Quick action buttons
│   └── Analytics overview charts
├── Student Monitor (Individual Deep-Dive)
│   ├── Student profile card
│   ├── Performance tracker view (read-only)
│   ├── Test history with reports
│   ├── Assignment history
│   ├── AI insights panel (Claude-generated student summary)
│   └── Quick actions (assign test, notify student/parent)
├── Teacher Analytics
│   ├── Performance trends (line chart)
│   ├── Topic mastery heatmap
│   ├── At-risk student identification
│   ├── Assignment analytics
│   └── Export options (CSV, PDF)
├── Backend
│   ├── Teacher-specific API endpoints
│   ├── Grade/section filtering queries
│   ├── RLS policies for teacher access scope
│   └── Analytics aggregation queries
└── Testing: Teacher journey E2E, RLS validation, performance

Deliverables:
- Teacher dashboard fully functional
- Student monitoring working
- Analytics operational

Acceptance Criteria:
✓ Teacher sees only students in assigned grades/sections
✓ Filter bar works correctly
✓ Individual student deep-dive shows complete data
✓ At-risk identification accurate
✓ Analytics charts render with real data
```

#### Sprint 19-20: Teacher Portal - Test Assignment & Assignments (Weeks 19-20)
```
Tasks:
├── Test Assignment
│   ├── Multi-step configuration form (same as student test builder)
│   ├── Step 3: Assign to grade/section/individuals
│   ├── Due date & late policy configuration
│   ├── AI question generation (same Claude pipeline)
│   ├── Assignment creation in database
│   ├── Automated notification dispatch (students + parents)
│   ├── Real-time completion tracking
│   └── Class-level results view post-deadline
├── Assignment Manager
│   ├── Create assignment page
│   ├── Assignment types (test, practice, resource)
│   ├── Assignment list with completion stats
│   ├── Per-assignment detail with student submissions
│   ├── Bulk actions (extend deadline, remind, close)
│   └── Automated 24h reminder emails
├── Student Side: Assignments Tab
│   ├── Assignments list (pending/completed/overdue)
│   ├── Start assignment → creates test session
│   ├── Submit assignment
│   └── View score & report after grading
├── Assignment Lifecycle Backend
│   ├── assignments + assignment_submissions tables
│   ├── RLS policies
│   ├── Submission tracking
│   ├── Late penalty calculation
│   └── Overdue status automation (pg_cron or Edge Function)
└── Testing: Full assignment lifecycle E2E

Deliverables:
- Test assignment fully working
- Assignment management operational
- Student assignment tab functional
- Automated notifications for assignments

Acceptance Criteria:
✓ Teacher can configure & assign test to grade/section
✓ Students receive notification & can take assigned test
✓ Completion tracking real-time
✓ Late submissions handled correctly
✓ Reminders sent 24h before deadline
```

#### Sprint 21-22: Teacher Notification Center & Email System (Weeks 21-22)
```
Tasks:
├── Notification Compose Page
│   ├── Recipient selection (students/parents/both, by grade/section)
│   ├── Rich text message editor
│   ├── Priority & category selection
│   ├── Recipient count preview
│   ├── Email preview before sending
│   └── Send / Schedule functionality
├── Email System Enhancement
│   ├── Resend bulk dispatch with batch processing (up to 100 recipients/call)
│   ├── React Email templates for all notification types (/src/emails/*.tsx)
│   ├── Delivery tracking via email_log table + Resend webhook integration
│   ├── Bounce/failure handling with retry logic
│   └── Unsubscribe management (Resend suppression list)
├── Scheduled Notifications
│   ├── Supabase Edge Function: Weekly parent digest
│   ├── Supabase Edge Function: Weekly student digest
│   ├── Supabase Edge Function: Assignment reminders
│   ├── pg_cron scheduling configuration
│   └── Digest email template
├── Notification History
│   ├── Teacher: Sent notifications with delivery stats
│   ├── Read receipts (in-app)
│   └── Resend capability
└── Testing: Bulk email, scheduling, delivery tracking

Deliverables:
- Teacher notification center complete
- Bulk email working
- Scheduled digests operational
- Delivery tracking functional

Acceptance Criteria:
✓ Teacher can compose & send to grade/section
✓ Students + parents receive in-app + email
✓ Weekly digest emails sent on schedule
✓ Delivery tracking accurate
✓ Unsubscribe works
```

#### Sprint 23-24: Integration, Polish & Beta (Weeks 23-24)
```
Tasks:
├── Cross-Portal Integration
│   ├── Verify data flows: Teacher assigns → Student receives → Parent sees
│   ├── Notification chain: Teacher → Student (in-app + email) + Parent (email)
│   ├── Report accessibility across portals
│   └── Real-time updates across portals (Supabase Realtime)
├── Polish
│   ├── UI/UX review across all three portals
│   ├── Loading states, empty states, error states
│   ├── Mobile responsiveness audit
│   ├── Performance optimization (queries, caching)
│   └── Accessibility audit (WCAG 2.1 AA)
├── Beta Testing (Phase 2)
│   ├── Recruit 10-20 teachers, 50-100 parents
│   ├── Existing 200+ student beta users
│   ├── Full workflow testing
│   ├── Feedback collection
│   └── Bug fixes
├── Security Audit
│   ├── RLS policy comprehensive review (all roles)
│   ├── Parent access scope verification
│   ├── Teacher access scope verification
│   ├── Email security (SPF, DKIM, DMARC)
│   └── COPPA/FERPA compliance check
└── Documentation
    ├── Teacher onboarding guide
    ├── Parent onboarding guide
    └── Updated API documentation

Deliverables:
- All three portals operational and integrated
- Beta-tested with all user types
- Security audit passed
- Documentation complete

Phase 2 Summary:
✓ Parent portal live (dashboard, tracker, reports, assignments, notifications)
✓ Teacher portal live (dashboard, monitoring, test assignment, assignments, notifications, analytics)
✓ Cross-portal integration verified
✓ Email system operational
✓ Scheduled notifications working
✓ Beta-tested with teachers + parents
```

---

### Phase 3: Enhancement, Growth & Launch (Weeks 25-34)

#### Sprint 25-26: Gamification & Engagement (Weeks 25-26)
```
Tasks:
├── Achievement Badges
│   ├── Perfect Score, Speed Racer, Consistency Champion, Topic Master, Comeback Story
│   ├── Badge display on student dashboard
│   ├── Badge notification on earn
│   └── Parent visibility of child's badges
├── Streaks & Milestones
│   ├── Daily practice streak counter
│   ├── Milestone celebrations (animations)
│   └── Questions answered counter
├── Leaderboards (Opt-in)
│   ├── Class leaderboard (by section)
│   ├── Subject-specific leaderboards
│   ├── Weekly leaderboard
│   └── Privacy controls & anonymization
└── Visual Progress
    ├── Animated progress bars
    ├── Celebration animations
    └── Personal growth chart
```

#### Sprint 27-28: AI Quality & Advanced Testing (Weeks 27-28)
```
Tasks:
├── Adaptive Testing Algorithm
│   ├── Item Response Theory (IRT) integration
│   ├── Dynamic difficulty adjustment mid-test
│   ├── Question difficulty calibration from student responses
│   └── Improved topic weighting based on long-term trends
├── AI Quality Improvements
│   ├── Prompt optimization based on beta feedback
│   ├── Question quality scoring (automated)
│   ├── Human review pipeline (sampling)
│   ├── Feedback loop: student "flag question" → quality review
│   └── A/B testing prompt variants
├── Learning Resources Integration
│   ├── YouTube tutorials linked to topics
│   ├── Textbook chapter references
│   ├── Interactive simulations
│   └── AI-curated resource recommendations
└── Content Expansion
    ├── Expand to 10+ subjects (including all 4 Social Science subjects for Grades 9-10)
    ├── Full curriculum coverage (grades 6-12)
    │   └── Full 11-12 stream subjects seeded: Science (Physics, Chemistry, Math, Biology),
    │       Commerce (Accountancy, Business Studies, Economics), Arts (History, Political Science, etc.)
    │       plus all elective subjects with complete topic hierarchies
    └── Question bank seeding (1000+ questions)
```

#### Sprint 29-30: Infrastructure & Scale (Weeks 29-30)
```
Tasks:
├── Performance Optimization
│   ├── Database query optimization (EXPLAIN ANALYZE)
│   ├── Connection pooling (Supabase Supavisor)
│   ├── Redis caching strategy review
│   ├── API response time: <2s p95
│   └── Core Web Vitals: All green
├── Load Testing
│   ├── Target: 1000+ concurrent students
│   ├── 100+ concurrent teachers
│   ├── Bulk email: 10,000 emails/hour
│   └── Identify and fix bottlenecks
├── Monitoring & Alerting
│   ├── Sentry error tracking (all portals)
│   ├── Vercel Analytics (Core Web Vitals)
│   ├── PostHog product analytics
│   ├── Custom dashboards (Supabase + Grafana)
│   └── PagerDuty/Opsgenie alerting
├── Disaster Recovery
│   ├── Supabase daily backups verified
│   ├── Point-in-time recovery tested
│   ├── Failover procedures documented
│   └── RTO: 4 hours, RPO: 1 hour
└── Security Hardening
    ├── Penetration testing
    ├── Rate limiting tuning
    ├── DDoS protection (Vercel)
    └── Annual security audit schedule
```

#### Sprint 31-32: Content & Localization (Weeks 31-32)
```
Tasks:
├── Content Management
│   ├── Admin panel for subjects + topics CRUD (basic)
│   ├── Bulk import from CSV (topics, questions)
│   ├── Question bank management
│   └── Quality assurance workflow
├── Multi-Language Support (Future-Ready)
│   ├── i18n framework setup (next-intl)
│   ├── English (default) fully translated
│   ├── Hindi translation (priority)
│   └── Translation management workflow
├── Accessibility
│   ├── WCAG 2.1 AA compliance audit
│   ├── Screen reader testing
│   ├── Keyboard navigation audit
│   └── High contrast mode
└── SEO & Marketing Pages
    ├── Landing page
    ├── Features page (student/parent/teacher)
    ├── Pricing page
    └── Blog/content marketing setup
```

#### Sprint 33-34: Launch & Post-Launch (Weeks 33-34)
```
Tasks:
├── Pre-Launch Checklist
│   ├── Security audit completed
│   ├── COPPA/FERPA compliance verified
│   ├── Privacy policy & Terms of Service reviewed
│   ├── Performance benchmarks met
│   ├── Load testing passed
│   ├── Disaster recovery tested
│   ├── Support team trained
│   ├── Documentation complete
│   ├── Marketing materials ready
│   └── Analytics tracking verified
├── Launch
│   ├── Public launch (phased rollout)
│   ├── School onboarding program
│   ├── Teacher training webinars
│   ├── Parent onboarding guide
│   └── Press release & social media
├── Post-Launch (Ongoing)
│   ├── 24/7 monitoring
│   ├── Bug triage & rapid fixes
│   ├── User feedback collection
│   ├── Feature iteration based on data
│   ├── Community building
│   └── Growth marketing

Phase 3 Summary:
✓ Gamification system active
✓ Advanced adaptive testing
✓ 1000+ questions across 10+ subjects
✓ Infrastructure scaled for 1000+ concurrent users
✓ Security hardened
✓ Platform publicly launched
✓ School onboarding program active
```

---

## 6. TECHNOLOGY STACK DETAILED

### 6.1 Complete Tech Stack

```
FRONTEND
├── Framework:        Next.js 16 (App Router, React Server Components, Turbopack, TypeScript 5+)
├── UI Library:       React 19
├── Styling:          Tailwind CSS v4
├── Component Library: shadcn/ui + Radix UI primitives
├── Animations:       Motion (smooth page transitions, micro-interactions, gamification effects)
├── State Management: Zustand v5 (client state) + TanStack Query v5 (server state + caching)
├── Real-time:        Supabase Realtime (WebSockets for live notifications + performance updates)
├── Charts:           Recharts
├── Forms:            React Hook Form v8 + Zod v3 (validation)
├── Toasts:           Sonner
├── Math Rendering:   KaTeX (LaTeX for equations in questions)
├── PDFs:             @react-pdf/renderer (test reports, student exports)
├── Rich Text:        Tiptap (teacher notification compose)
├── Testing:          Vitest + React Testing Library + Playwright (E2E)
└── Build/Deploy:     Vercel (Turbopack in dev, optimized production builds)

BACKEND
├── API Pattern:      Server Actions (React 19 mutations) + Next.js Route Handlers (REST)
├── ORM:              Drizzle ORM + drizzle-kit (type-safe queries, schema-as-code, migrations)
├── Runtime:          Node.js 22+
├── Authentication:   Supabase Auth (JWT, role-based) via @supabase/ssr
├── Database:         Supabase PostgreSQL (managed, Drizzle connects via DATABASE_URL)
├── Vector Storage:   Supabase pgvector (RAG embeddings)
├── Caching:          Upstash Redis (serverless, pay-per-use)
├── Job Queue:        BullMQ (Upstash Redis-backed) or Supabase Edge Functions
├── Scheduled Tasks:  pg_cron + Supabase Edge Functions (digests, reminders)
├── File Storage:     Supabase Storage (PDF reports, resources)
├── Email:            Resend (transactional + bulk) + React Email (type-safe templates)
├── Error Tracking:   Sentry
├── Monitoring:       Vercel Analytics + PostHog
└── Logging:          Vercel Logs + Logtail

AI / ML
├── LLM:              OpenAI GPT-5.4 mini (`gpt-5.4-mini`; ChatGPT 5.4 mini class)
├── App LLM SDK:      Vercel AI SDK (`ai`, `@ai-sdk/openai`) for server-side generation, structured outputs, and agent-style tool loops — not vendor-specific agent SDKs used directly in app code
├── Embeddings:       Voyage AI (voyage-3-lite for topic + question embeddings)
├── RAG:              Supabase pgvector + cosine similarity search
├── Prompt Management: Versioned prompt templates in codebase (/src/lib/prompts/)
├── Structured Output: Provider JSON / schema-backed generation + Zod validation (via Vercel AI SDK `Output.object` where used)
└── Quality Framework: Automated scoring + human review sampling pipeline

INFRASTRUCTURE
├── Hosting:          Vercel (Edge Runtime + Serverless Functions)
├── Database:         Supabase (managed PostgreSQL + pgvector)
├── CDN:              Vercel Edge Network
├── DNS:              Vercel or Cloudflare
├── CI/CD:            GitHub Actions → Vercel (preview + production deployments)
├── Secrets:          Vercel Environment Variables (never committed to git)
├── Backup:           Supabase automated daily backups (30-day retention)
└── Version Control:  GitHub

DEVELOPMENT TOOLS
├── Package Manager:  pnpm
├── Linting/Format:   Biome (replaces ESLint + Prettier — faster, single config)
├── Pre-commit:       Husky + lint-staged (runs Biome + type-check on staged files)
├── API Docs:         OpenAPI/Swagger (auto-generated from Zod schemas)
├── DB Migrations:    drizzle-kit (generate + migrate + studio for visual schema browser)
├── Type Safety:      TypeScript strict mode throughout — no `any` types permitted
└── Project Management: Linear or GitHub Projects

COMPLIANCE & SECURITY
├── Authentication:   JWT via Supabase Auth, OAuth/SSO future
├── Authorization:    Row-Level Security (RLS) on every Supabase table
├── Encryption:       TLS in transit, AES-256 at rest (Supabase managed)
├── Data Privacy:     GDPR, COPPA (<13), FERPA compliance built-in
├── Audit:            audit_logs table for all sensitive operations
├── Penetration Testing: Annual security audits
├── Backup:           Daily + 30-day retention (Supabase)
└── Email Security:   SPF, DKIM, DMARC configured via Resend domain settings
```

### 6.2 Why This Stack?

| Choice | Reason |
|--------|--------|
| **Next.js 16 (App Router)** | Route groups enable clean multi-portal architecture within a single app. React 19 Server Components reduce client bundle size. Turbopack gives sub-second HMR. Server Actions replace boilerplate API routes for mutations. Vercel-native deployment with zero config. |
| **Drizzle ORM** | Fully type-safe queries — schema defined in TypeScript, so the database and application types are always in sync. Lightweight with no runtime overhead vs Prisma. drizzle-kit handles migrations and provides a visual schema browser (drizzle-studio). Works natively with Supabase's Postgres connection string. |
| **Supabase** | PostgreSQL with RLS is the right foundation for multi-role access control. Built-in Auth with role metadata eliminates a separate auth service. pgvector enables RAG without an additional vector database. Realtime handles live notification push. Edge Functions run scheduled jobs. Single platform — database, auth, storage, realtime — reduces operational complexity. |
| **Separated subjects + topics tables** | Two purpose-built tables replace the self-referencing `curriculum_items` approach. The `subjects` table maps grades to subjects with stream/elective support for 11-12. The `topics` table stores flat curriculum content (topic, chapter, unit, grade, subject_id) for simple querying. The `subject_group` field on `subjects` handles multi-book subjects (Social Science → 4 subjects) for UI grouping. This design avoids deep hierarchical queries, simplifies joins, and keeps the schema easy to reason about. |
| **Claude AI (Anthropic)** | Best-in-class instruction following for structured question generation. 200K token context window. Consistent JSON mode output validated with Zod. Claude claude-sonnet-4-20250514 delivers the accuracy needed for NCERT-aligned pedagogy. |
| **Vercel AI SDK** | Single TypeScript surface for multiple model providers, structured outputs (`Output.object` + Zod), streaming, and agent loops (`ToolLoopAgent` / tools) on Vercel-hosted Next.js — replaces direct use of the OpenAI Agents SDK in application code. |
| **Tailwind CSS v4 + shadcn/ui** | Tailwind v4's new engine is significantly faster and uses CSS-native variables. shadcn/ui provides accessible, fully customizable components as source code — no black-box library. Three portals share the component library but have distinct colour tokens and layouts. |
| **Motion** | The de-facto React animation standard (formerly Framer Motion, rebranded 2024). Used for portal page transitions, dashboard card entrance animations, gamification celebrations (badge unlocks, streak milestones), and micro-interactions on test cards and progress bars. Zero-config React 19 compatible. |
| **Resend + React Email** | Resend has a generous free tier (3,000 emails/month), a clean modern API, and first-class React Email support. React Email lets us build email templates as typed React components with full preview in the browser — no Handlebars/Mjml context-switching. SPF/DKIM/DMARC configured via Resend's domain panel. |
| **TanStack Query v5** | Handles server state, background refetching, stale-while-revalidate, and optimistic updates. Works alongside Zustand (which owns pure client UI state). v5 has a leaner API and better TypeScript inference than v4. |
| **Upstash Redis** | Serverless-compatible Redis — no persistent connection management needed on Vercel. Used for API rate limiting (per-role), dashboard data caching (5-min TTL), and BullMQ job queues for async email dispatch. Pay-per-request pricing scales to zero in dev. |
| **Biome** | Single tool replacing ESLint + Prettier. 10–100x faster than ESLint due to Rust implementation. One config file. Enforces consistent code style and catches errors without the plugin ecosystem fragmentation of ESLint. |
| **Vitest** | Native ESM, Vite-powered test runner that shares the same transform pipeline as Next.js. Significantly faster than Jest for unit and integration tests. Compatible with React Testing Library. Playwright handles E2E. |

### 6.3 Cost Estimates

```
DEVELOPMENT PHASE (Months 1-8)
├── Vercel Pro: $20/month = $160
├── Supabase Pro: $25/month = $200
├── Anthropic API (dev/testing): $150/month = $1,200
├── Upstash Redis: Free tier → $10/month = $80
├── Resend: Free tier (3,000 emails/month) → $0 during dev
├── Sentry: Free tier
├── Domain: $12/year
└── Total Development Phase: ~$1,650-1,850

PRODUCTION PHASE (Post-Launch)
├── Vercel Pro: $50/month
├── Supabase Pro: $25-50/month (scale as needed)
├── Anthropic API:
│   ├── 1,000 students x 15 tests/month x 2 API calls = 30K calls
│   ├── Plus teacher-assigned tests: +10K calls
│   ├── Reports generation: +5K calls
│   └── Estimated: $200-400/month
├── Upstash Redis: $50-200/month
├── Resend Pro: $20/month (50,000 emails/month, scales linearly after)
├── Sentry Pro: $29/month
├── PostHog: Free tier initially
└── Total Monthly: ~$375-750 (scales with users)

ANNUAL PROJECTION
├── Development Year: $7,000-10,000
├── Year 1 (Post-Launch): $12,000-20,000
├── Year 2+: $20,000-45,000 (scales with user base)
```

---

## 7. RISK ANALYSIS & MITIGATION

### 7.1 Key Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Claude API Rate Limits/Downtime** | Test generation delays | Medium | Request higher limits, implement queuing, fallback to cached questions |
| **RLS Policy Misconfiguration** | Data leakage across roles | High | Comprehensive RLS testing suite, automated policy verification, security audit |
| **Parent-Student Linking Abuse** | Unauthorized access to student data | Medium | Email verification, student confirmation, audit logging, revoke capability |
| **Email Deliverability** | Notifications not reaching parents/students | Medium | SPF/DKIM/DMARC setup, dedicated IP, warm-up schedule, bounce handling |
| **Teacher Portal Adoption** | Low teacher engagement, manual processes | High | Teacher training, onboarding program, school partnerships, champion program |
| **Data Privacy (COPPA/FERPA)** | Legal issues, loss of trust | Medium | Legal review, consent mechanisms, data minimization, annual audit |
| **Question Quality Consistency** | Student dissatisfaction | High | Prompt engineering iteration, human review, quality metrics, feedback loops |
| **Multi-Portal Complexity** | Development delays, bugs | High | Shared component library, comprehensive testing, phased rollout |
| **Scaling Issues** | Performance degradation | Medium | Load testing, auto-scaling, connection pooling, caching strategy |

### 7.2 Mitigation Strategies

```
Technical Mitigations:
├── Comprehensive Testing
│   ├── Unit tests (>80% coverage)
│   ├── RLS policy tests (automated, per-role verification)
│   ├── Integration tests for cross-portal data flows
│   ├── E2E tests for all user journeys (student, parent, teacher)
│   ├── Load testing (1000+ concurrent users)
│   └── Security testing (OWASP, penetration testing)
├── Data Protection
│   ├── RLS policies for every table with role-specific access
│   ├── Parent access scoped to linked children only
│   ├── Teacher access scoped to assigned grades/sections only
│   ├── Audit logging for all sensitive operations
│   ├── Encryption (TLS + at-rest)
│   └── GDPR/COPPA/FERPA compliance built-in
├── Monitoring & Alerting
│   ├── Real-time monitoring (Sentry, Vercel Analytics)
│   ├── API response time tracking (p95 <2s)
│   ├── Email delivery rate monitoring
│   ├── Notification delivery tracking
│   └── Alert thresholds with on-call rotation
└── Failover & Recovery
    ├── Supabase daily backups (30-day retention)
    ├── Claude API fallback (cached question bank)
    ├── Email retry with exponential backoff
    ├── Graceful degradation (offline-capable test-taking)
    └── Disaster recovery: RTO 4h, RPO 1h

Business Mitigations:
├── Teacher Adoption
│   ├── School partnership program
│   ├── Free teacher accounts always
│   ├── Teacher champion/ambassador program
│   ├── Training webinars and tutorials
│   └── Dedicated teacher support channel
├── User Retention
│   ├── Gamification (badges, streaks, leaderboards)
│   ├── Personalized engagement (AI recommendations)
│   ├── Parent weekly digest (keeps parents engaged)
│   ├── Feature iteration based on feedback
│   └── Community features (forums, study groups)
└── Legal & Compliance
    ├── Legal review (GDPR, COPPA, FERPA)
    ├── Privacy policy & Terms of Service
    ├── Parental consent mechanisms for <13
    ├── Data processing agreements
    └── Annual security and compliance audit
```

---

## 8. SUCCESS METRICS & KPIs

### 8.1 Primary Metrics

```
USER ACQUISITION & ENGAGEMENT
├── Student Registration Conversion: 20-25%
├── Parent Signup Rate: 50%+ of registered students have linked parents
├── Teacher Signup Rate: Target 100+ teachers by Month 6
├── 30-Day Retention (Student): 40%+
├── Weekly Active Students: 60%+ of registered
├── Weekly Active Parents: 50%+ of registered
├── Weekly Active Teachers: 80%+ of registered
└── Viral Coefficient: 1.2+

TEST-TAKING BEHAVIOR
├── Tests per Student per Week: 3-5 (active users)
├── Average Session Duration: 45-60 min
├── Test Completion Rate: 85%+
├── Assignment Completion Rate: 90%+
├── Subject Diversity: 2+ subjects per student
└── Topic Mastery Rate: 40%+ of topics in "Good" status

TEACHER ENGAGEMENT
├── Tests Assigned per Teacher per Week: 2-3
├── Notifications Sent per Teacher per Week: 3-5
├── Student Monitoring Frequency: Daily
├── Assignment Creation Rate: 1-2 per week
└── Analytics Dashboard Usage: 3+ times per week

PARENT ENGAGEMENT
├── Dashboard Check Frequency: 2-3 times per week
├── Report Views: 80%+ of child's reports viewed
├── Notification Read Rate: 90%+
└── Parent Satisfaction Score: 4.0+/5.0

PLATFORM PERFORMANCE
├── API Response Time (p95): <2 seconds
├── Page Load Time: <3 seconds
├── Uptime: 99.9%+
├── Error Rate: <0.1%
├── Claude API Success Rate: >98%
├── Email Delivery Rate: >99%
└── Notification Delivery Latency: <5 seconds (in-app)

BUSINESS METRICS
├── Customer Acquisition Cost (CAC): <$5
├── Lifetime Value (LTV): >$50
├── Monthly Recurring Revenue: $0 → $5,000+ by Month 12
├── Churn Rate: <5% monthly
└── Free-to-Paid Conversion: 5-10%
```

---

## 9. IMPLEMENTATION CHECKLIST

### Pre-Development
- [ ] Architecture review & approval
- [ ] Database schema review (subjects, topics, profiles with stream/elective, RLS policies)
- [ ] Design system finalization (three portal layouts)
- [ ] Supabase project creation
- [ ] GitHub repository setup
- [ ] CI/CD pipeline (GitHub Actions → Vercel)
- [ ] Resend account setup + domain verification (SPF/DKIM/DMARC)
- [ ] Anthropic API key provisioned
- [ ] Development environment documentation

### Phase 1 (Student Portal MVP)
- [ ] Sprint 1-2: Foundation, auth, subjects + topics schema, design system
- [ ] Sprint 3-4: Dashboard, performance tracker
- [ ] Sprint 5-6: Test builder, Claude integration
- [ ] Sprint 7-8: Test area, interactive testing
- [ ] Sprint 9-10: Reports, grading, performance updates
- [ ] Sprint 11-12: Notifications, email, polish
- [ ] Sprint 13-14: Beta testing, stabilization
- [ ] Beta: 100-200 students tested

### Phase 2 (Parent + Teacher Portals)
- [ ] Sprint 15-16: Parent portal (linking, dashboard, tracker, reports)
- [ ] Sprint 17-18: Teacher dashboard, student monitoring, analytics
- [ ] Sprint 19-20: Test assignment, assignment manager
- [ ] Sprint 21-22: Teacher notification center, email system
- [ ] Sprint 23-24: Integration, polish, beta testing (teachers + parents)
- [ ] Security audit: All RLS policies verified across 3 roles

### Phase 3 (Growth & Launch)
- [ ] Sprint 25-26: Gamification
- [ ] Sprint 27-28: AI quality improvements, advanced testing
- [ ] Sprint 29-30: Infrastructure scaling, load testing
- [ ] Sprint 31-32: Content expansion, localization
- [ ] Sprint 33-34: Launch preparation, public launch

### Pre-Launch
- [ ] Security audit completed
- [ ] COPPA/FERPA compliance verified
- [ ] Privacy policy & Terms reviewed by legal
- [ ] Performance benchmarks met (1000+ concurrent users)
- [ ] Load testing passed
- [ ] Disaster recovery tested
- [ ] Support infrastructure ready
- [ ] Documentation complete (all portals)
- [ ] Marketing materials ready
- [ ] Analytics tracking verified

---

## 9.5 SAAS SUBSCRIPTIONS (v3.1 ADDITION)

EduAI is distributed as a SaaS with a hybrid free trial and two paid tiers billed via Razorpay Subscriptions + UPI Autopay. This section documents plan rules, enforcement, and operator runbooks.

### 9.5.1 Plans

| Code | Name | Price (INR) | Tests / period | AI output tokens — doubt chat (grades 6-10) | AI output tokens — doubt chat (grades 11-12) | Pool |
| --- | --- | --- | --- | --- | --- | --- |
| `free` | Free Trial | ₹0 | 5 | 50,000 | 50,000 | One-off 14 days |
| `pro_monthly` | Pro Monthly | ₹1,000 / month | 30 | 200,000 | 400,000 | Resets monthly |
| `pro_annual` | Pro Annual | ₹10,000 / year | 360 | 2,400,000 | 4,800,000 | 12-month pool |

Rules:
- Trial auto-starts on student profile creation via the `seed_free_trial_for_student()` trigger; trial ends after 14 days or when any quota is exhausted.
- **One free trial per login identity:** the trigger records the first student to claim a normalized email (Gmail / Googlemail local-part folding) or, if the auth user has no email, a normalized phone key. Additional student accounts that resolve to the same identity receive `subscriptions.status = expired` on `plan_code = free` with no usage window (they may still subscribe or redeem a coupon). See migration `supabase/migrations/20260423110000_free_trial_once_per_identity.sql`.
- Hybrid: students may opt to add a UPI mandate during the trial (`startMode=after_trial`) so the first charge fires exactly when the trial ends.
- Annual plans pool quotas across 12 months (burn at any pace) rather than reset monthly.
- Grade-based token quotas are resolved at enforcement time from `profiles.grade`. Token quotas count **model output (completion) tokens** from doubt-chat turns, not prompt tokens.

### 9.5.2 Data model (see `supabase/migrations/20260423000001_saas_billing.sql`)

- `plans` — seeded catalog (one row per plan code)
- `free_trial_claims` — one row per normalized email/phone identity; ties the platform free trial to the first `profile_id` that claimed it (`20260423110000_free_trial_once_per_identity.sql`)
- `subscriptions` — one row per student; tracks status (`trialing | active | coupon | grace | past_due | cancelled | expired`), Razorpay subscription/customer IDs, trial + period windows, `cancel_at_period_end`, and a `staff_override` escape hatch for internal testers
- `usage_periods` — per-period ledger; atomic increments via RPC `billing_consume_test` / `billing_consume_tokens`
- `payments` — Razorpay receipt log keyed by `razorpay_payment_id`
- `coupons` + `coupon_redemptions` — shared campaign codes (e.g. `PARENT100`) with max-redemption caps
- `billing_events` — append-only idempotent webhook log keyed by `razorpay_event_id`

### 9.5.3 Enforcement

- `src/lib/billing/entitlements.ts` exposes `getEntitlements`, `consumeTest`, `consumeTokens`, `canStartDoubtChat`, and `rolloverPeriodIfNeeded`.
- Gated at: practice generate server action (`generatePracticeTest`), practice generate stream route, doubt-chat POST route. Returns HTTP 402 + `paywall: true` so the UI can surface the reusable paywall dialog.
- Feature flag `SAAS_ENFORCEMENT` turns gating on (production) or off (local dev); `subscriptions.staff_override=true` preserves access for internal testers.

### 9.5.4 Razorpay wiring

- Secrets: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
- Seed plans once per environment: `pnpm razorpay:seed-plans` (or use the Razorpay MCP). Copy returned plan IDs into `public.plans.razorpay_plan_id`.
- Client checkout: `src/components/student/subscription/razorpay-checkout.tsx` dynamically injects `https://checkout.razorpay.com/v1/checkout.js` and opens with `subscription_id` + UPI/card mandate flow.
- Webhooks: point Razorpay Dashboard → Webhooks to `POST /api/billing/webhook` with `RAZORPAY_WEBHOOK_SECRET`. Handlers update subscription/usage rows, log payments, fire React-Email transactional notifications via Resend, and write Sentry breadcrumbs on error.

### 9.5.5 Lifecycle events

Analytics (`practice_analytics_events`): `subscription_started`, `subscription_upgraded`, `subscription_cancelled`, `subscription_payment_failed`, `coupon_redeemed`, `paywall_shown`, `upgrade_clicked`.

Emails (Resend, `src/lib/email/subscription-notifications.ts`): trial ending in 3 days / 1 day, subscription active, payment failed, usage near limit. The trial reminder cron lives at `POST /api/internal/billing/trial-emails`; idempotent via `subscriptions.metadata.trial_emails_sent`.

### 9.5.6 Admin runbooks

**Add a new coupon code** (via service-role psql or Supabase SQL editor):

```sql
INSERT INTO public.coupons (code, description, max_redemptions, duration_days, grants_plan_code, expires_at)
VALUES ('PARENT200', 'Spring 2026 parent drive', 200, 30, 'pro_monthly', NOW() + INTERVAL '90 days');
```

**Grant a staff override** so a specific profile ignores quotas (keeps other enforcement intact):

```sql
UPDATE public.subscriptions SET staff_override = TRUE WHERE profile_id = '<uuid>';
```

**Flip a subscription back to trialing** (rare — only for support escalations):

```sql
UPDATE public.subscriptions
SET status = 'trialing',
    trial_ends_at = NOW() + INTERVAL '14 days',
    current_period_end = NOW() + INTERVAL '14 days'
WHERE profile_id = '<uuid>';
```

**Trial identity false positive** (support only — removes the global lock so another signup with that email could claim a trial again):

```sql
DELETE FROM public.free_trial_claims WHERE identity_key = '<normalized key>';
```

Then repair the affected `subscriptions` / `usage_periods` rows manually if needed.

### 9.5.7 Legal

Razorpay requires a visible refund/cancellation policy; link to `/legal/refund` and `/legal/terms` is rendered on the Subscription page.

---

## 10. CONCLUSION

This v3.0 Product Development Report introduces a major schema redesign focused on simplicity, separation of concerns, and clean data organization, while preserving the three-portal architecture and all feature capabilities.

**Separated Schema Design:** The unified `curriculum_items` self-referencing table has been replaced with two purpose-built tables. The `subjects` table maps grades to subjects with built-in support for streams and electives in grades 11-12. The `topics` table stores flat curriculum content (topic, chapter, unit, grade, subject reference) enabling simple queries without deep hierarchical traversals. This separation makes the data model easier to reason about, seed, query, and maintain.

**Lean Student Profiles:** Student profiles no longer store subject data. A student's subjects are resolved dynamically from the `subjects` table based on their grade (and for 11-12: stream + elective choice). This eliminates data duplication and ensures subject lists stay consistent with the source of truth.

**Stream & Elective System:** Grades 11-12 students select a stream (Science/Commerce/Arts) during signup, which determines their core subjects. They also choose one elective from a pool of available options. The `subjects` table handles this via `stream` and `is_elective` columns with constraint validation ensuring data integrity.

**Auto-Initialized Performance Tracker:** Upon successful signup, the system automatically creates `performance_tracker` rows for every topic across all of the student's resolved subjects, with status `not_tested`. This ensures the tracker is immediately populated and ready for use without any manual setup.

**Three-Portal Architecture:** Building student, parent, and teacher portals within a single Next.js 16 application using route groups provides code sharing efficiency while maintaining clear separation of concerns. Supabase RLS policies enforce data boundaries at the database level, ensuring parents see only their linked child's data and teachers access only their assigned grades/sections.

**Communication Infrastructure:** The multi-channel notification system (in-app + email to students and parents) bridges the communication gap between teachers, students, and parents, creating a closed loop of accountability and visibility.

**Timeline:** MVP (Student Portal): 14 weeks | Full Platform (All Portals): 24 weeks | Launch-Ready: 34 weeks

**Tech Stack:** Next.js 16 + React 19 + Drizzle ORM + Supabase + Vercel AI SDK + Claude AI + Tailwind CSS v4 + shadcn/ui + Motion + Resend + React Email, deployed on Vercel.

**Target:** 5,000+ students, 1,000+ parents, 200+ teachers by end of Year 1.

---

**Document Version:** 3.0 | **Last Updated:** April 12, 2026 | **Next Review:** May 12, 2026

**v3.0 Changes:** Major schema redesign. Replaced unified `curriculum_items` self-referencing table with two separate tables: `subjects` (grade-to-subject mapping with stream/elective/subject_group support) and `topics` (flat curriculum content with subject, chapter, unit, grade attributes). Removed subject data from student profiles; subjects now resolved dynamically from `subjects` table. Added `stream` and `elective_subject_id` fields to profiles for grades 11-12. Student signup no longer requires subject selection (grades 6-10 subjects are fixed; grades 11-12 require stream + optional elective selection). Performance tracker rows auto-initialized on signup for all topics with status `not_tested` (renamed from `empty`). Added `initialize_performance_tracker()`, `get_student_subjects()`, `get_available_electives()`, `get_topics_for_subject()`, `get_units_for_subject()` helper functions. Updated all FK references across tests, questions, assignments, resources, teacher_assignments tables. Updated RLS policies for new table structure. Updated all API endpoints to use `/api/subjects/*` and `/api/topics/*` instead of `/api/curriculum/*`. Updated signup flows, test builder, performance tracker, and all sprint deliverables throughout.

**v2.2 Changes:** Full tech stack upgrade. Next.js 14 → Next.js 16 (React 19, Turbopack). Added Drizzle ORM + drizzle-kit as the sole database access layer (type-safe schema-as-code, replaces raw SQL in application code). SendGrid/Resend → Resend exclusively, paired with React Email for type-safe template components. Added Motion for animations (page transitions, micro-interactions, gamification). React Query → TanStack Query v5. Jest → Vitest. ESLint + Prettier → Biome. Node.js 20+ → Node.js 22+. Anthropic embeddings → Voyage AI. All `SendGrid` and `Next.js 14` references updated throughout document.

**v2.1 Changes:** Multi-book subject handling via `subject_group` column. Social Science (Grades 9-10) split into Geography, History, Economics, Political Science as independent subjects with UI grouping.
