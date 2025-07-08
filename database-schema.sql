-- ===================================================
-- DJEI User Management System Database Schema
-- ===================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================================
-- MAIN USER TABLES
-- ===================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  attendee_id UUID,
  dj_id UUID,
  venue_id UUID,
  permissions JSONB DEFAULT '{"role": "attendee", "features": []}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  
  -- Ensure only one role per user
  CONSTRAINT single_role_check CHECK (
    (attendee_id IS NOT NULL AND dj_id IS NULL AND venue_id IS NULL) OR
    (attendee_id IS NULL AND dj_id IS NOT NULL AND venue_id IS NULL) OR
    (attendee_id IS NULL AND dj_id IS NULL AND venue_id IS NOT NULL)
  )
);

-- Profiles table (main user profile data)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  phone TEXT,
  location TEXT,
  website TEXT,
  role TEXT NOT NULL DEFAULT 'attendee' CHECK (role IN ('attendee', 'dj', 'venue', 'admin')),
  profile_completion_percentage INTEGER DEFAULT 0 CHECK (profile_completion_percentage >= 0 AND profile_completion_percentage <= 100),
  is_profile_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ===================================================
-- ROLE-SPECIFIC TABLES
-- ===================================================

-- Attendee profiles
CREATE TABLE attendee (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  spotify_token TEXT,
  music_preferences JSONB DEFAULT '[]',
  favorite_genres TEXT[] DEFAULT '{}',
  music_discovery_preference TEXT DEFAULT 'balanced' CHECK (music_discovery_preference IN ('popular', 'underground', 'balanced')),
  preferred_event_types TEXT[] DEFAULT '{}',
  typical_budget_range TEXT CHECK (typical_budget_range IN ('under_50', '50_100', '100_200', '200_plus')),
  loyalty_points INTEGER DEFAULT 0,
  token_balance INTEGER DEFAULT 0,
  questionnaire_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  
  UNIQUE(profile_id)
);

-- DJ profiles
CREATE TABLE dj (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stage_name TEXT,
  bio TEXT,
  genres TEXT[] DEFAULT '{}',
  experience_years INTEGER DEFAULT 0,
  hourly_rate NUMERIC(10,2),
  equipment_provided BOOLEAN DEFAULT false,
  music_portfolio JSONB DEFAULT '{}',
  social_links JSONB DEFAULT '{}',
  subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'pro', 'premium')),
  genre_specialization TEXT,
  booking_rate NUMERIC(10,2),
  availability_schedule JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  
  UNIQUE(profile_id)
);

-- Venue profiles
CREATE TABLE venue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  venue_name TEXT,
  address TEXT,
  venue_type TEXT,
  capacity INTEGER,
  amenities TEXT[] DEFAULT '{}',
  description TEXT,
  booking_email TEXT,
  business_info JSONB DEFAULT '{}',
  owner_user_id UUID REFERENCES auth.users(id),
  operating_hours JSONB DEFAULT '{}',
  pricing_info JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  
  UNIQUE(profile_id)
);

-- ===================================================
-- TOKEN SYSTEM
-- ===================================================

-- User tokens
CREATE TABLE user_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0 CHECK (balance >= 0),
  total_earned INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  
  UNIQUE(profile_id)
);

-- Token transactions
CREATE TABLE token_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'bid', 'refund', 'bonus', 'reward', 'admin_adjustment')),
  description TEXT,
  reference_id UUID, -- Can reference events, songs, etc.
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ===================================================
-- INDEXES FOR PERFORMANCE
-- ===================================================

-- Profile indexes
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_completion ON profiles(profile_completion_percentage);

-- Role-specific indexes
CREATE INDEX idx_attendee_profile ON attendee(profile_id);
CREATE INDEX idx_dj_profile ON dj(profile_id);
CREATE INDEX idx_venue_profile ON venue(profile_id);

-- Token indexes
CREATE INDEX idx_user_tokens_profile ON user_tokens(profile_id);
CREATE INDEX idx_token_transactions_profile ON token_transactions(profile_id);
CREATE INDEX idx_token_transactions_type ON token_transactions(transaction_type);
CREATE INDEX idx_token_transactions_date ON token_transactions(created_at DESC);

-- ===================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ===================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendee_updated_at BEFORE UPDATE ON attendee FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dj_updated_at BEFORE UPDATE ON dj FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_venue_updated_at BEFORE UPDATE ON venue FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_tokens_updated_at BEFORE UPDATE ON user_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================
-- ROW LEVEL SECURITY (RLS)
-- ===================================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendee ENABLE ROW LEVEL SECURITY;
ALTER TABLE dj ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Role-specific policies
CREATE POLICY "Users can view own attendee profile" ON attendee FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can update own attendee profile" ON attendee FOR UPDATE USING (auth.uid() = profile_id);

CREATE POLICY "Users can view own dj profile" ON dj FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can update own dj profile" ON dj FOR UPDATE USING (auth.uid() = profile_id);

CREATE POLICY "Users can view own venue profile" ON venue FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can update own venue profile" ON venue FOR UPDATE USING (auth.uid() = profile_id);

-- Token policies
CREATE POLICY "Users can view own tokens" ON user_tokens FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can view own token transactions" ON token_transactions FOR SELECT USING (auth.uid() = profile_id);

-- ===================================================
-- STORED PROCEDURES FOR ATOMIC OPERATIONS
-- ===================================================

-- Create user with role-specific profile
CREATE OR REPLACE FUNCTION create_user_with_role(
  user_id UUID,
  user_email TEXT,
  user_role TEXT,
  profile_data JSONB DEFAULT '{}'
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  role_table_id UUID;
BEGIN
  -- Validate role
  IF user_role NOT IN ('attendee', 'dj', 'venue') THEN
    RAISE EXCEPTION 'Invalid role: %', user_role;
  END IF;

  -- Create main profile
  INSERT INTO profiles (id, email, role, first_name, last_name)
  VALUES (
    user_id,
    user_email,
    user_role,
    COALESCE(profile_data->>'first_name', ''),
    COALESCE(profile_data->>'last_name', '')
  );

  -- Create role-specific profile
  CASE user_role
    WHEN 'attendee' THEN
      INSERT INTO attendee (profile_id) VALUES (user_id) RETURNING id INTO role_table_id;
    WHEN 'dj' THEN
      INSERT INTO dj (profile_id) VALUES (user_id) RETURNING id INTO role_table_id;
    WHEN 'venue' THEN
      INSERT INTO venue (profile_id) VALUES (user_id) RETURNING id INTO role_table_id;
  END CASE;

  -- Initialize tokens
  INSERT INTO user_tokens (profile_id, balance) VALUES (user_id, 50);

  -- Update users table with role reference
  INSERT INTO users (id, email, permissions) VALUES (
    user_id,
    user_email,
    jsonb_build_object(
      'role', user_role,
      'features', ARRAY[]::TEXT[],
      'role_table_id', role_table_id
    )
  );

  -- Update the appropriate foreign key
  CASE user_role
    WHEN 'attendee' THEN
      UPDATE users SET attendee_id = role_table_id WHERE id = user_id;
    WHEN 'dj' THEN
      UPDATE users SET dj_id = role_table_id WHERE id = user_id;
    WHEN 'venue' THEN
      UPDATE users SET venue_id = role_table_id WHERE id = user_id;
  END CASE;

  result := jsonb_build_object(
    'success', true,
    'user_id', user_id,
    'role', user_role,
    'role_table_id', role_table_id
  );

  RETURN result;
EXCEPTION
  WHEN others THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================
-- SAMPLE DATA FOR TESTING
-- ===================================================

-- Insert sample data (commented out for production)
/*
-- Sample attendee
INSERT INTO profiles (id, email, role, first_name, last_name) 
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'john@example.com', 'attendee', 'John', 'Doe');

INSERT INTO attendee (profile_id, favorite_genres, music_discovery_preference) 
VALUES ('550e8400-e29b-41d4-a716-446655440000', ARRAY['house', 'techno'], 'balanced');

INSERT INTO user_tokens (profile_id, balance) 
VALUES ('550e8400-e29b-41d4-a716-446655440000', 100);
*/ 