-- Add status column for waitlist support
ALTER TABLE public.rsvps
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'waitlist'));

CREATE INDEX IF NOT EXISTS rsvps_event_status_created_idx
  ON public.rsvps (event_id, status, created_at);

-- Allow users to update their own rsvps (needed for promotion via SECURITY DEFINER trigger;
-- trigger runs as definer so this is just for completeness — not strictly required)

-- BEFORE INSERT: enforce capacity, assign confirmed or waitlist
CREATE OR REPLACE FUNCTION public.rsvp_assign_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cap integer;
  confirmed_count integer;
BEGIN
  -- Lock the event row to serialize capacity checks
  SELECT capacity INTO cap FROM public.events WHERE id = NEW.event_id FOR UPDATE;

  IF cap IS NULL THEN
    NEW.status := 'confirmed';
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO confirmed_count
  FROM public.rsvps
  WHERE event_id = NEW.event_id AND status = 'confirmed';

  IF confirmed_count < cap THEN
    NEW.status := 'confirmed';
  ELSE
    NEW.status := 'waitlist';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rsvps_assign_status ON public.rsvps;
CREATE TRIGGER rsvps_assign_status
  BEFORE INSERT ON public.rsvps
  FOR EACH ROW
  EXECUTE FUNCTION public.rsvp_assign_status();

-- AFTER DELETE: if a confirmed seat opens up, promote the oldest waitlisted RSVP
CREATE OR REPLACE FUNCTION public.rsvp_promote_waitlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_id uuid;
BEGIN
  IF OLD.status <> 'confirmed' THEN
    RETURN OLD;
  END IF;

  SELECT id INTO next_id
  FROM public.rsvps
  WHERE event_id = OLD.event_id AND status = 'waitlist'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF next_id IS NOT NULL THEN
    UPDATE public.rsvps SET status = 'confirmed' WHERE id = next_id;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS rsvps_promote_waitlist ON public.rsvps;
CREATE TRIGGER rsvps_promote_waitlist
  AFTER DELETE ON public.rsvps
  FOR EACH ROW
  EXECUTE FUNCTION public.rsvp_promote_waitlist();