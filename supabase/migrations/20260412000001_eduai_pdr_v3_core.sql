-- EduAI PDR v3.0 — extensions, tables (FK-safe order), helper functions
-- Order: subjects → topics → profiles → links → performance_tracker → domain tables

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- SUBJECTS (before profiles — elective FK)
-- ============================================================
CREATE TABLE public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(250) NOT NULL,
    grade INT NOT NULL CHECK (grade BETWEEN 6 AND 12),
    subject_group VARCHAR(200) DEFAULT NULL,
    stream VARCHAR(50) DEFAULT NULL CHECK (stream IN ('science', 'commerce', 'arts') OR stream IS NULL),
    is_elective BOOLEAN DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT stream_subject_grade_check CHECK (
        grade IN (11, 12) OR (stream IS NULL AND is_elective = FALSE)
    )
);

CREATE INDEX idx_subjects_grade ON public.subjects(grade);
CREATE INDEX idx_subjects_stream ON public.subjects(stream) WHERE stream IS NOT NULL;
CREATE INDEX idx_subjects_elective ON public.subjects(is_elective) WHERE is_elective = TRUE;
CREATE INDEX idx_subjects_group ON public.subjects(subject_group) WHERE subject_group IS NOT NULL;
CREATE INDEX idx_subjects_grade_stream ON public.subjects(grade, stream);

-- ============================================================
-- TOPICS
-- ============================================================
CREATE TABLE public.topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    grade INT NOT NULL CHECK (grade BETWEEN 6 AND 12),
    unit_name VARCHAR(250) NOT NULL,
    unit_number INT NOT NULL,
    chapter_name VARCHAR(250) NOT NULL,
    chapter_number INT NOT NULL,
    topic_name VARCHAR(250) NOT NULL,
    topic_number INT NOT NULL,
    description TEXT,
    learning_objectives TEXT[],
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_topics_subject ON public.topics(subject_id);
CREATE INDEX idx_topics_grade ON public.topics(grade);
CREATE INDEX idx_topics_subject_grade ON public.topics(subject_id, grade);
CREATE INDEX idx_topics_unit ON public.topics(subject_id, unit_number);
CREATE INDEX idx_topics_chapter ON public.topics(subject_id, unit_number, chapter_number);

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(200) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'parent', 'teacher', 'admin')),
    grade INT CHECK (grade BETWEEN 6 AND 12),
    section VARCHAR(5),
    stream VARCHAR(50) CHECK (stream IN ('science', 'commerce', 'arts') OR stream IS NULL),
    elective_subject_id UUID REFERENCES public.subjects(id),
    school_name VARCHAR(300),
    parent_name VARCHAR(200),
    parent_email VARCHAR(320),
    subjects_taught UUID[],
    avatar_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    last_active_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT stream_grade_check CHECK (
        (grade IN (11, 12) AND role = 'student') OR stream IS NULL
    ),
    CONSTRAINT elective_grade_check CHECK (
        (grade IN (11, 12) AND role = 'student') OR elective_subject_id IS NULL
    ),
    CONSTRAINT stream_required_for_senior CHECK (
        (grade NOT IN (11, 12)) OR (role != 'student') OR (stream IS NOT NULL)
    )
);

CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_grade_section ON public.profiles(grade, section);
CREATE INDEX idx_profiles_stream ON public.profiles(stream) WHERE stream IS NOT NULL;

-- ============================================================
-- PARENT-STUDENT LINKS & TEACHER ASSIGNMENTS
-- ============================================================
CREATE TABLE public.parent_student_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
    linked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(parent_id, student_id)
);

CREATE INDEX idx_parent_links_parent ON public.parent_student_links(parent_id);
CREATE INDEX idx_parent_links_student ON public.parent_student_links(student_id);

CREATE TABLE public.teacher_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    grade INT NOT NULL CHECK (grade BETWEEN 6 AND 12),
    section VARCHAR(5) NOT NULL,
    subject_id UUID NOT NULL REFERENCES public.subjects(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(teacher_id, grade, section, subject_id)
);

CREATE INDEX idx_teacher_assign_teacher ON public.teacher_assignments(teacher_id);
CREATE INDEX idx_teacher_assign_grade_section ON public.teacher_assignments(grade, section);

-- ============================================================
-- PERFORMANCE TRACKER
-- ============================================================
CREATE TABLE public.performance_tracker (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id),
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

CREATE INDEX idx_perf_student_subject ON public.performance_tracker(student_id, subject_id);
CREATE INDEX idx_perf_status ON public.performance_tracker(status);
CREATE INDEX idx_perf_student ON public.performance_tracker(student_id);

-- ============================================================
-- TESTS, QUESTIONS, ANSWERS, REPORTS
-- ============================================================
CREATE TABLE public.tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id),
    unit_name VARCHAR(250),
    test_type VARCHAR(20) DEFAULT 'self'
        CHECK (test_type IN ('self', 'assigned')),
    assignment_id UUID,
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

CREATE INDEX idx_tests_student ON public.tests(student_id);
CREATE INDEX idx_tests_status ON public.tests(status);
CREATE INDEX idx_tests_assignment ON public.tests(assignment_id);
CREATE INDEX idx_tests_type ON public.tests(test_type);

CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES public.topics(id),
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL
        CHECK (question_type IN ('multiple_choice', 'short_answer', 'numerical')),
    difficulty_level VARCHAR(10) CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
    answer_key JSONB NOT NULL,
    options JSONB,
    question_number INT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    embedding vector(1536)
);

CREATE INDEX idx_questions_test ON public.questions(test_id);
CREATE INDEX idx_questions_topic ON public.questions(topic_id);

CREATE TABLE public.student_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    student_answer JSONB NOT NULL,
    is_correct BOOLEAN,
    score_earned DECIMAL(5, 2) CHECK (score_earned BETWEEN 0 AND 100),
    ai_feedback TEXT,
    time_spent_seconds INT,
    flagged_for_review BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_answers_test ON public.student_answers(test_id);

CREATE TABLE public.test_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE UNIQUE,
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
-- ASSIGNMENTS
-- ============================================================
CREATE TABLE public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    assignment_type VARCHAR(20) DEFAULT 'test'
        CHECK (assignment_type IN ('test', 'practice', 'resource')),
    subject_id UUID NOT NULL REFERENCES public.subjects(id),
    unit_name VARCHAR(250),
    topic_ids UUID[],
    difficulty VARCHAR(10) CHECK (difficulty IN ('easy', 'medium', 'hard', 'mixed')),
    question_count INT DEFAULT 20,
    time_limit_seconds INT DEFAULT 3600,
    target_grades INT[] NOT NULL,
    target_sections VARCHAR(5)[] NOT NULL,
    target_student_ids UUID[],
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

CREATE INDEX idx_assignments_teacher ON public.assignments(teacher_id);
CREATE INDEX idx_assignments_status ON public.assignments(status);
CREATE INDEX idx_assignments_due ON public.assignments(due_date);

CREATE TABLE public.assignment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    test_id UUID REFERENCES public.tests(id),
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

CREATE INDEX idx_submissions_assignment ON public.assignment_submissions(assignment_id);
CREATE INDEX idx_submissions_student ON public.assignment_submissions(student_id);
CREATE INDEX idx_submissions_status ON public.assignment_submissions(status);

-- ============================================================
-- NOTIFICATIONS, EMAIL LOG, RESOURCES, PREFERENCES, AUDIT
-- ============================================================
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id),
    title VARCHAR(300) NOT NULL,
    body TEXT NOT NULL,
    type VARCHAR(30) NOT NULL
        CHECK (type IN ('assignment', 'test_result', 'announcement', 'reminder',
                        'alert', 'system', 'encouragement')),
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
    category VARCHAR(30),
    reference_type VARCHAR(30),
    reference_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notif_recipient ON public.notifications(recipient_id, is_read);
CREATE INDEX idx_notif_created ON public.notifications(created_at DESC);

CREATE TABLE public.email_log (
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

CREATE TABLE public.resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
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

CREATE TABLE public.user_preferences (
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

CREATE TABLE public.audit_logs (
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
-- HELPER FUNCTIONS (invoker — safe)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_student_subjects(
    p_grade INT,
    p_stream VARCHAR DEFAULT NULL,
    p_elective_id UUID DEFAULT NULL
)
RETURNS SETOF public.subjects
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF p_grade BETWEEN 6 AND 10 THEN
        RETURN QUERY
            SELECT * FROM public.subjects
            WHERE grade = p_grade AND is_elective = FALSE AND is_active = TRUE
            ORDER BY sort_order, name;
    ELSIF p_grade IN (11, 12) THEN
        RETURN QUERY
            SELECT * FROM public.subjects
            WHERE grade = p_grade AND is_active = TRUE
            AND (
                (stream IS NULL AND is_elective = FALSE)
                OR (stream = p_stream AND is_elective = FALSE)
                OR (id = p_elective_id)
            )
            ORDER BY sort_order, name;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_available_electives(p_grade INT)
RETURNS SETOF public.subjects
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
    SELECT * FROM public.subjects
    WHERE grade = p_grade AND is_elective = TRUE AND is_active = TRUE
    ORDER BY sort_order, name;
$$;

CREATE OR REPLACE FUNCTION public.get_all_subjects_for_grade(p_grade INT)
RETURNS SETOF public.subjects
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
    SELECT * FROM public.subjects
    WHERE grade = p_grade AND is_active = TRUE
    ORDER BY subject_group NULLS LAST, sort_order, name;
$$;

CREATE OR REPLACE FUNCTION public.get_topics_for_subject(p_subject_id UUID, p_grade INT)
RETURNS SETOF public.topics
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
    SELECT * FROM public.topics
    WHERE subject_id = p_subject_id AND grade = p_grade AND is_active = TRUE
    ORDER BY unit_number, chapter_number, topic_number;
$$;

CREATE OR REPLACE FUNCTION public.get_units_for_subject(p_subject_id UUID, p_grade INT)
RETURNS TABLE(unit_name VARCHAR, unit_number INT, topic_count BIGINT)
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
    SELECT t.unit_name, t.unit_number, COUNT(*)::bigint AS topic_count
    FROM public.topics t
    WHERE t.subject_id = p_subject_id AND t.grade = p_grade AND t.is_active = TRUE
    GROUP BY t.unit_name, t.unit_number
    ORDER BY t.unit_number;
$$;

CREATE OR REPLACE FUNCTION public.initialize_performance_tracker(
    p_student_id UUID,
    p_grade INT,
    p_stream VARCHAR DEFAULT NULL,
    p_elective_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    INSERT INTO public.performance_tracker (student_id, topic_id, subject_id, status)
    SELECT
        p_student_id,
        t.id,
        t.subject_id,
        'not_tested'
    FROM public.topics t
    INNER JOIN public.get_student_subjects(p_grade, p_stream, p_elective_id) s
        ON t.subject_id = s.id
    WHERE t.grade = p_grade AND t.is_active = TRUE
    ON CONFLICT (student_id, topic_id) DO NOTHING;
END;
$$;
