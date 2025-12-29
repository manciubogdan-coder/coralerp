-- Drop type if exists to avoid conflict
DROP TYPE IF EXISTS public.app_user_role CASCADE;

-- Create enum for user roles
CREATE TYPE public.app_user_role AS ENUM ('admin', 'user');

-- Create profiles table for this app
CREATE TABLE public.app_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email TEXT NOT NULL,
    name TEXT,
    approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user roles table
CREATE TABLE public.app_user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_user_role NOT NULL DEFAULT 'user',
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.app_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_app_role(_user_id UUID, _role app_user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.app_user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Function to check if user is approved
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.app_profiles
        WHERE user_id = _user_id
          AND approved = true
    )
$$;

-- RLS Policies for app_profiles
CREATE POLICY "Users can view their own profile"
ON public.app_profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.app_profiles
FOR SELECT
USING (public.has_app_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own profile"
ON public.app_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update any profile"
ON public.app_profiles
FOR UPDATE
USING (public.has_app_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete profiles"
ON public.app_profiles
FOR DELETE
USING (public.has_app_role(auth.uid(), 'admin'));

-- RLS Policies for app_user_roles
CREATE POLICY "Users can view their own roles"
ON public.app_user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.app_user_roles
FOR SELECT
USING (public.has_app_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.app_user_roles
FOR ALL
USING (public.has_app_role(auth.uid(), 'admin'));

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_app_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_app_profiles_updated_at
BEFORE UPDATE ON public.app_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_app_profiles_updated_at();

-- Insert the existing user as admin
INSERT INTO public.app_profiles (user_id, email, name, approved)
SELECT id, email, raw_user_meta_data->>'name', true
FROM auth.users 
WHERE email = 'manciubogdan999@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- Add admin role for the existing user
INSERT INTO public.app_user_roles (user_id, role)
SELECT id, 'admin'::app_user_role
FROM auth.users 
WHERE email = 'manciubogdan999@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;