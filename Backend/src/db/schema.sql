-- LMS Nexus PostgreSQL Schema
-- AI-Enabled Multivendor Learning Management System

-- Shared hosts usually cannot install uuid-ossp. Use gen_random_uuid()
-- (built into PostgreSQL 13+, or pgcrypto on older versions).
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF to_regprocedure('gen_random_uuid()') IS NULL THEN
    CREATE FUNCTION gen_random_uuid()
    RETURNS uuid
    LANGUAGE sql
    VOLATILE
    AS $fn$
      SELECT md5(random()::text || clock_timestamp()::text)::uuid;
    $fn$;
  END IF;
END
$$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'instructor', 'student');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE course_status AS ENUM ('draft', 'pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'enrollment', 'course_update', 'approval', 'rejection',
    'announcement', 'review', 'payment', 'system'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  avatar_url TEXT,
  bio TEXT,
  headline VARCHAR(255),
  expertise TEXT[],
  website VARCHAR(255),
  social_links JSONB DEFAULT '{}',
  is_banned BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(120) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(280) UNIQUE NOT NULL,
  description TEXT,
  short_description VARCHAR(500),
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_price DECIMAL(10,2),
  discount_percent INTEGER DEFAULT 0,
  status course_status NOT NULL DEFAULT 'draft',
  thumbnail_url TEXT,
  preview_video_url TEXT,
  level VARCHAR(50) DEFAULT 'Beginner',
  language VARCHAR(50) DEFAULT 'English',
  is_featured BOOLEAN DEFAULT FALSE,
  is_trending BOOLEAN DEFAULT FALSE,
  rejection_reason TEXT,
  requirements TEXT[],
  learning_outcomes TEXT[],
  tags TEXT[],
  total_duration INTEGER DEFAULT 0,
  enrollment_count INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  sequence_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content_type VARCHAR(50) DEFAULT 'video',
  video_url TEXT,
  document_url TEXT,
  content TEXT,
  duration INTEGER DEFAULT 0,
  is_preview BOOLEAN DEFAULT FALSE,
  sequence_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  progress_percentage DECIMAL(5,2) DEFAULT 0,
  completed_lessons UUID[] DEFAULT '{}',
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  certificate_issued BOOLEAN DEFAULT FALSE,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, course_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID UNIQUE REFERENCES enrollments(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  instructor_id UUID NOT NULL REFERENCES users(id),
  amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  instructor_earning DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'BDT',
  payment_method VARCHAR(50) DEFAULT 'card',
  payment_status payment_status DEFAULT 'pending',
  transaction_id VARCHAR(100),
  eps_transaction_id VARCHAR(64),
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  card_last4 VARCHAR(4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eps_ipn_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eps_transaction_id VARCHAR(64),
  merchant_transaction_id VARCHAR(100),
  store_id VARCHAR(64),
  status VARCHAR(32),
  total_amount DECIMAL(12,4),
  store_amount DECIMAL(12,4),
  transaction_type VARCHAR(64),
  financial_entity VARCHAR(128),
  ipn_timestamp BIGINT,
  raw_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

