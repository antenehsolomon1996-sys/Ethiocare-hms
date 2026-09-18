-- ==============================================================================
-- EthioCare HMS - Secure Staff Authentication & Role Isolation Migration
-- ==============================================================================

-- 1. Add optional password_hash column to public.staff if not exists
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2. Revoke anonymous SELECT and UPDATE policies that exposed activation codes
DROP POLICY IF EXISTS "Staff activation verify allowed for anonymous" ON public.staff;
DROP POLICY IF EXISTS "Staff activation code marked used" ON public.staff;

-- 3. Secure Staff Login Function (SECURITY DEFINER)
-- Bypasses RLS to verify credentials server-side without exposing activation codes
CREATE OR REPLACE FUNCTION public.verify_staff_login(
  p_email TEXT,
  p_credential TEXT,
  p_target_portal TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_staff RECORD;
  v_is_valid BOOLEAN := false;
  v_clean_email TEXT;
  v_clean_credential TEXT;
BEGIN
  v_clean_email := lower(trim(p_email));
  v_clean_credential := trim(p_credential);

  -- 1. Find staff member
  SELECT * INTO v_staff
  FROM public.staff
  WHERE lower(email) = v_clean_email;

  IF v_staff IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid hospital email or credentials.'
    );
  END IF;

  -- 2. Check active status
  IF v_staff.status != 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Your staff account has been deactivated. Please contact administration.'
    );
  END IF;

  -- 3. Enforce strict 1:1 portal role restrictions
  IF p_target_portal IS NOT NULL AND p_target_portal != '' THEN
    IF v_staff.role != p_target_portal THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Access denied. %s credentials cannot access the %s portal.', 
          initcap(replace(v_staff.role, '_', ' ')), 
          initcap(replace(p_target_portal, '_', ' '))
        )
      );
    END IF;
  END IF;

  -- 4. Verify credentials:
  -- Check A: Matches assigned activation code (case-insensitive)
  IF v_staff.activation_code IS NOT NULL AND upper(v_staff.activation_code) = upper(v_clean_credential) THEN
    v_is_valid := true;
  -- Check B: Matches default setup password
  ELSIF v_clean_credential = 'Hospital@2026' THEN
    v_is_valid := true;
  -- Check C: Matches hashed password if password was set
  ELSIF v_staff.password_hash IS NOT NULL AND v_staff.password_hash = crypt(v_clean_credential, v_staff.password_hash) THEN
    v_is_valid := true;
  END IF;

  IF NOT v_is_valid THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid password or staff activation code.'
    );
  END IF;

  -- 5. Mark activation code as used and update last_login
  UPDATE public.staff
  SET 
    activation_used = true,
    last_login = now(),
    updated_at = now()
  WHERE id = v_staff.id;

  -- 6. Synchronize public.profiles
  INSERT INTO public.profiles (
    id, email, full_name, role, department, specialization, phone, status, updated_at
  ) VALUES (
    v_staff.id, v_staff.email, v_staff.full_name, v_staff.role,
    v_staff.department, v_staff.specialization, v_staff.phone, v_staff.status, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department = EXCLUDED.department,
    specialization = EXCLUDED.specialization,
    phone = EXCLUDED.phone,
    status = EXCLUDED.status,
    updated_at = now();

  -- Return verified profile without sensitive secrets
  RETURN jsonb_build_object(
    'success', true,
    'profile', jsonb_build_object(
      'id', v_staff.id,
      'email', v_staff.email,
      'full_name', v_staff.full_name,
      'role', v_staff.role,
      'department', v_staff.department,
      'specialization', v_staff.specialization,
      'phone', v_staff.phone,
      'status', v_staff.status
    )
  );
END;
$$;

-- 4. Secure Staff Account Activation Function (NO OTP REQUIRED)
CREATE OR REPLACE FUNCTION public.activate_staff_account(
  p_email TEXT,
  p_activation_code TEXT,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_staff RECORD;
  v_clean_email TEXT;
  v_clean_code TEXT;
BEGIN
  v_clean_email := lower(trim(p_email));
  v_clean_code := upper(trim(p_activation_code));

  IF length(p_new_password) < 8 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Password must be at least 8 characters in length.'
    );
  END IF;

  SELECT * INTO v_staff
  FROM public.staff
  WHERE lower(email) = v_clean_email;

  IF v_staff IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No staff member found with this email address.'
    );
  END IF;

  IF v_staff.status != 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This staff account is deactivated. Contact administration.'
    );
  END IF;

  IF upper(v_staff.activation_code) != v_clean_code THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid activation code for this staff account.'
    );
  END IF;

  -- Update staff record with hashed password and mark activation completed
  UPDATE public.staff
  SET 
    password_hash = crypt(p_new_password, gen_salt('bf')),
    activation_used = true,
    password_set = true,
    last_login = now(),
    updated_at = now()
  WHERE id = v_staff.id;

  -- Ensure profile exists
  INSERT INTO public.profiles (
    id, email, full_name, role, department, specialization, phone, status, updated_at
  ) VALUES (
    v_staff.id, v_staff.email, v_staff.full_name, v_staff.role,
    v_staff.department, v_staff.specialization, v_staff.phone, v_staff.status, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department = EXCLUDED.department,
    specialization = EXCLUDED.specialization,
    phone = EXCLUDED.phone,
    status = EXCLUDED.status,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Account successfully activated.',
    'profile', jsonb_build_object(
      'id', v_staff.id,
      'email', v_staff.email,
      'full_name', v_staff.full_name,
      'role', v_staff.role,
      'department', v_staff.department,
      'specialization', v_staff.specialization,
      'phone', v_staff.phone,
      'status', v_staff.status
    )
  );
END;
$$;

-- Grant execution to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.verify_staff_login(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_staff_account(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
