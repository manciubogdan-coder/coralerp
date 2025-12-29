-- Drop the function first if it exists with wrong signature
DROP FUNCTION IF EXISTS public.handle_new_app_user() CASCADE;

-- Function to handle new user signup (creates profile automatically)
CREATE OR REPLACE FUNCTION public.handle_new_app_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.app_profiles (user_id, email, name, approved)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', ''),
        CASE WHEN NEW.email = 'manciubogdan999@gmail.com' THEN true ELSE false END
    );
    
    -- If it's the initial admin, also add admin role
    IF NEW.email = 'manciubogdan999@gmail.com' THEN
        INSERT INTO public.app_user_roles (user_id, role)
        VALUES (NEW.id, 'admin');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Use a unique trigger name for this app
CREATE TRIGGER on_auth_user_created_app_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_app_user();