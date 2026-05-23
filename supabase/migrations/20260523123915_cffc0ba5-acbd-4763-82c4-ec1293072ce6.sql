
-- =========================================
-- 1. Events: hidden flag for moderation
-- =========================================
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

-- Update public read policy to exclude hidden
DROP POLICY IF EXISTS "Published events are viewable by everyone" ON public.events;
CREATE POLICY "Published non-hidden events are viewable by everyone"
ON public.events FOR SELECT
TO public
USING (status = 'published' AND hidden = false);

-- =========================================
-- 2. Host-wide checkers
-- =========================================
CREATE TABLE public.host_checkers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (host_user_id, user_id)
);
ALTER TABLE public.host_checkers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host can view own checkers"
ON public.host_checkers FOR SELECT TO authenticated
USING (host_user_id = auth.uid());

CREATE POLICY "Checker can view self link"
ON public.host_checkers FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Host can remove checkers"
ON public.host_checkers FOR DELETE TO authenticated
USING (host_user_id = auth.uid());

-- Inserts happen via security-definer function (invite redemption); no INSERT policy.

-- =========================================
-- 3. Checker invites
-- =========================================
CREATE TABLE public.checker_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  host_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  used_by uuid,
  used_at timestamptz
);
ALTER TABLE public.checker_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host can manage own invites"
ON public.checker_invites FOR ALL TO authenticated
USING (host_user_id = auth.uid())
WITH CHECK (host_user_id = auth.uid());

-- Function to redeem invite token: validates and inserts into host_checkers
CREATE OR REPLACE FUNCTION public.redeem_checker_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv record;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  SELECT * INTO inv FROM public.checker_invites
    WHERE token = _token
    FOR UPDATE;

  IF inv IS NULL THEN
    RAISE EXCEPTION 'Invalid invite';
  END IF;
  IF inv.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite already used';
  END IF;
  IF inv.expires_at < now() THEN
    RAISE EXCEPTION 'Invite expired';
  END IF;
  IF inv.host_user_id = uid THEN
    RAISE EXCEPTION 'Cannot redeem your own invite';
  END IF;

  INSERT INTO public.host_checkers (host_user_id, user_id)
    VALUES (inv.host_user_id, uid)
    ON CONFLICT (host_user_id, user_id) DO NOTHING;

  UPDATE public.checker_invites
    SET used_by = uid, used_at = now()
    WHERE id = inv.id;

  RETURN inv.host_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_checker_invite(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_checker_invite(text) TO authenticated;

-- =========================================
-- 4. Update can_check_in_event to include host-wide checkers
-- =========================================
CREATE OR REPLACE FUNCTION public.can_check_in_event(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = _event_id AND e.created_by = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.event_checkers c WHERE c.event_id = _event_id AND c.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.host_checkers hc ON hc.host_user_id = e.created_by
    WHERE e.id = _event_id AND hc.user_id = auth.uid()
  );
$$;

-- Helper: list event ids a user can check in
CREATE OR REPLACE FUNCTION public.checker_event_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id FROM public.events e
  WHERE e.created_by = auth.uid()
  UNION
  SELECT c.event_id FROM public.event_checkers c WHERE c.user_id = auth.uid()
  UNION
  SELECT e.id FROM public.events e
  JOIN public.host_checkers hc ON hc.host_user_id = e.created_by
  WHERE hc.user_id = auth.uid();
$$;

-- =========================================
-- 5. Event feedback
-- =========================================
CREATE TABLE public.event_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;

-- Public can read feedback for published, non-hidden events
CREATE POLICY "Anyone can read feedback for published events"
ON public.event_feedback FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM public.events e
  WHERE e.id = event_feedback.event_id
    AND e.status = 'published' AND e.hidden = false
));

-- Trigger to validate feedback submission
CREATE OR REPLACE FUNCTION public.validate_event_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev record;
  has_rsvp boolean;
BEGIN
  SELECT id, starts_at, ends_at INTO ev FROM public.events WHERE id = NEW.event_id;
  IF ev IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;
  IF COALESCE(ev.ends_at, ev.starts_at) > now() THEN
    RAISE EXCEPTION 'Event has not ended yet';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.rsvps
    WHERE event_id = NEW.event_id AND user_id = NEW.user_id AND status = 'confirmed'
  ) INTO has_rsvp;
  IF NOT has_rsvp THEN
    RAISE EXCEPTION 'Only confirmed attendees can submit feedback';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_event_feedback
BEFORE INSERT OR UPDATE ON public.event_feedback
FOR EACH ROW EXECUTE FUNCTION public.validate_event_feedback();

CREATE POLICY "Attendees can submit own feedback"
ON public.event_feedback FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Attendees can update own feedback"
ON public.event_feedback FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Attendees can delete own feedback"
ON public.event_feedback FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- =========================================
-- 6. Event photos
-- =========================================
CREATE TABLE public.event_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  storage_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  hidden boolean NOT NULL DEFAULT false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

-- Trigger: only confirmed attendees can submit photos
CREATE OR REPLACE FUNCTION public.validate_event_photo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_rsvp boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.rsvps
      WHERE event_id = NEW.event_id AND user_id = NEW.user_id AND status = 'confirmed'
    ) INTO has_rsvp;
    IF NOT has_rsvp THEN
      RAISE EXCEPTION 'Only confirmed attendees can upload photos';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_event_photo
BEFORE INSERT ON public.event_photos
FOR EACH ROW EXECUTE FUNCTION public.validate_event_photo();

-- Public read: approved + not hidden + event published & not hidden
CREATE POLICY "Approved photos are public"
ON public.event_photos FOR SELECT TO public
USING (
  status = 'approved' AND hidden = false
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_photos.event_id AND e.status = 'published' AND e.hidden = false
  )
);

CREATE POLICY "Uploader can view own photos"
ON public.event_photos FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Host can view event photos"
ON public.event_photos FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.events e WHERE e.id = event_photos.event_id AND e.created_by = auth.uid()
));

CREATE POLICY "Attendees can upload own photos"
ON public.event_photos FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Host can moderate event photos"
ON public.event_photos FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.events e WHERE e.id = event_photos.event_id AND e.created_by = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.events e WHERE e.id = event_photos.event_id AND e.created_by = auth.uid()
));

CREATE POLICY "Uploader can delete own pending photo"
ON public.event_photos FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-photos', 'event-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "event-photos public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'event-photos');

CREATE POLICY "event-photos authenticated upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "event-photos owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'event-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =========================================
-- 7. Reports
-- =========================================
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('event', 'photo')),
  target_id uuid NOT NULL,
  reporter_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'actioned')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can create reports"
ON public.reports FOR INSERT TO authenticated
WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Reporter can view own reports"
ON public.reports FOR SELECT TO authenticated
USING (reporter_id = auth.uid());

CREATE POLICY "Host can view reports on own events"
ON public.reports FOR SELECT TO authenticated
USING (
  (target_type = 'event' AND EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = reports.target_id AND e.created_by = auth.uid()
  ))
  OR
  (target_type = 'photo' AND EXISTS (
    SELECT 1 FROM public.event_photos p
    JOIN public.events e ON e.id = p.event_id
    WHERE p.id = reports.target_id AND e.created_by = auth.uid()
  ))
);

CREATE POLICY "Host can update reports on own events"
ON public.reports FOR UPDATE TO authenticated
USING (
  (target_type = 'event' AND EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = reports.target_id AND e.created_by = auth.uid()
  ))
  OR
  (target_type = 'photo' AND EXISTS (
    SELECT 1 FROM public.event_photos p
    JOIN public.events e ON e.id = p.event_id
    WHERE p.id = reports.target_id AND e.created_by = auth.uid()
  ))
)
WITH CHECK (true);

CREATE INDEX idx_reports_target ON public.reports (target_type, target_id);
CREATE INDEX idx_event_photos_event ON public.event_photos (event_id, status);
CREATE INDEX idx_event_feedback_event ON public.event_feedback (event_id);
