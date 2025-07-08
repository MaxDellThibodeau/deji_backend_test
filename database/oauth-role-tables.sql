-- OAuth Role Tables for DJEI Platform
-- This file creates the role-based tables for attendee, dj, and venue
-- Each table uses the auth.users.id as the primary key

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ATTENDEE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.attendee (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(50) UNIQUE,
    avatar_url TEXT,
    bio TEXT,
    favorite_genres TEXT[] DEFAULT '{}',
    location VARCHAR(255),
    phone VARCHAR(20),
    date_of_birth DATE,
    preferred_venues UUID[] DEFAULT '{}',
    followed_djs UUID[] DEFAULT '{}',
    notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}',
    privacy_settings JSONB DEFAULT '{"profile_visibility": "public", "location_sharing": "friends"}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- DJ TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.dj (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    stage_name VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,
    genres TEXT[] DEFAULT '{}',
    location VARCHAR(255),
    phone VARCHAR(20),
    years_experience INTEGER DEFAULT 0,
    hourly_rate DECIMAL(10,2),
    equipment_list TEXT[],
    spotify_id VARCHAR(255),
    soundcloud_url VARCHAR(255),
    instagram_handle VARCHAR(100),
    twitter_handle VARCHAR(100),
    website_url VARCHAR(255),
    availability_schedule JSONB DEFAULT '{}',
    performance_history JSONB DEFAULT '[]',
    ratings_average DECIMAL(3,2) DEFAULT 0.0,
    ratings_count INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_documents JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- VENUE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.venue (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    venue_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    description TEXT,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50),
    postal_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'US',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    phone VARCHAR(20),
    website_url VARCHAR(255),
    capacity INTEGER,
    venue_type VARCHAR(50), -- 'club', 'bar', 'restaurant', 'concert_hall', 'outdoor', 'private'
    music_genres TEXT[] DEFAULT '{}',
    amenities TEXT[] DEFAULT '{}',
    equipment_available TEXT[] DEFAULT '{}',
    operating_hours JSONB DEFAULT '{}',
    booking_info JSONB DEFAULT '{}',
    social_media JSONB DEFAULT '{}',
    images TEXT[] DEFAULT '{}',
    is_verified BOOLEAN DEFAULT FALSE,
    ratings_average DECIMAL(3,2) DEFAULT 0.0,
    ratings_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Attendee indexes
CREATE INDEX IF NOT EXISTS idx_attendee_username ON public.attendee(username);
CREATE INDEX IF NOT EXISTS idx_attendee_location ON public.attendee(location);
CREATE INDEX IF NOT EXISTS idx_attendee_created_at ON public.attendee(created_at);

-- DJ indexes
CREATE INDEX IF NOT EXISTS idx_dj_stage_name ON public.dj(stage_name);
CREATE INDEX IF NOT EXISTS idx_dj_location ON public.dj(location);
CREATE INDEX IF NOT EXISTS idx_dj_genres ON public.dj USING GIN(genres);
CREATE INDEX IF NOT EXISTS idx_dj_ratings ON public.dj(ratings_average DESC);
CREATE INDEX IF NOT EXISTS idx_dj_verified ON public.dj(is_verified);
CREATE INDEX IF NOT EXISTS idx_dj_created_at ON public.dj(created_at);

-- Venue indexes
CREATE INDEX IF NOT EXISTS idx_venue_name ON public.venue(venue_name);
CREATE INDEX IF NOT EXISTS idx_venue_city ON public.venue(city);
CREATE INDEX IF NOT EXISTS idx_venue_type ON public.venue(venue_type);
CREATE INDEX IF NOT EXISTS idx_venue_capacity ON public.venue(capacity);
CREATE INDEX IF NOT EXISTS idx_venue_genres ON public.venue USING GIN(music_genres);
CREATE INDEX IF NOT EXISTS idx_venue_location ON public.venue(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_venue_verified ON public.venue(is_verified);
CREATE INDEX IF NOT EXISTS idx_venue_ratings ON public.venue(ratings_average DESC);
CREATE INDEX IF NOT EXISTS idx_venue_created_at ON public.venue(created_at);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.attendee ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dj ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue ENABLE ROW LEVEL SECURITY;

-- Attendee policies
CREATE POLICY "Users can view their own attendee profile" ON public.attendee
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own attendee profile" ON public.attendee
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own attendee profile" ON public.attendee
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own attendee profile" ON public.attendee
    FOR DELETE USING (auth.uid() = id);

-- DJ policies
CREATE POLICY "Users can view their own dj profile" ON public.dj
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own dj profile" ON public.dj
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own dj profile" ON public.dj
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own dj profile" ON public.dj
    FOR DELETE USING (auth.uid() = id);

-- Public read access for DJ profiles (for discovery)
CREATE POLICY "Anyone can view public dj profiles" ON public.dj
    FOR SELECT USING (true);

-- Venue policies
CREATE POLICY "Users can view their own venue profile" ON public.venue
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own venue profile" ON public.venue
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own venue profile" ON public.venue
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own venue profile" ON public.venue
    FOR DELETE USING (auth.uid() = id);

-- Public read access for venue profiles (for discovery)
CREATE POLICY "Anyone can view public venue profiles" ON public.venue
    FOR SELECT USING (true);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

-- Function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for all tables
CREATE TRIGGER update_attendee_updated_at BEFORE UPDATE ON public.attendee
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dj_updated_at BEFORE UPDATE ON public.dj
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_venue_updated_at BEFORE UPDATE ON public.venue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    role_name TEXT;
BEGIN
    -- Check attendee table
    IF EXISTS (SELECT 1 FROM public.attendee WHERE id = user_id) THEN
        RETURN 'attendee';
    END IF;
    
    -- Check dj table
    IF EXISTS (SELECT 1 FROM public.dj WHERE id = user_id) THEN
        RETURN 'dj';
    END IF;
    
    -- Check venue table
    IF EXISTS (SELECT 1 FROM public.venue WHERE id = user_id) THEN
        RETURN 'venue';
    END IF;
    
    -- No role found
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has a role
CREATE OR REPLACE FUNCTION user_has_role(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_role(user_id) IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION get_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_role(UUID) TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.attendee IS 'Profile table for attendees/music lovers';
COMMENT ON TABLE public.dj IS 'Profile table for DJs';
COMMENT ON TABLE public.venue IS 'Profile table for venues/event spaces';

COMMENT ON FUNCTION get_user_role(UUID) IS 'Returns the role of a user (attendee, dj, venue, or null)';
COMMENT ON FUNCTION user_has_role(UUID) IS 'Checks if a user has been assigned a role'; 