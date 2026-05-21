-- Check-in tracking on rsvps
ALTER TABLE public.rsvps
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_in_by uuid;

-- Event checkers table
CREATE TABLE IF NOT EXISTS public.event_checkers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.event_checkers ENABLE ROW LEVEL SECURITY;

-- Hosts manage checkers
CREATE POLICY "Hosts can view their event checkers"
ON public.event_checkers FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.created_by = auth.uid()));

CREATE POLICY "Hosts can add checkers"
ON public.event_checkers FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.created_by = auth.uid()));

CREATE POLICY "Hosts can remove checkers"
ON public.event_checkers FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.created_by = auth.uid()));

-- Checkers can see their own assignment rows
CREATE POLICY "Checkers can view their own assignments"
ON public.event_checkers FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Helper function: is current user a checker (or host) for an event?
CREATE OR REPLACE FUNCTION public.can_check_in_event(_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = _event_id AND e.created_by = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.event_checkers c WHERE c.event_id = _event_id AND c.user_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_check_in_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_check_in_event(uuid) TO authenticated;

-- Allow hosts AND checkers to view RSVPs for their events (for check-in flow)
CREATE POLICY "Hosts and checkers can view event rsvps"
ON public.rsvps FOR SELECT TO authenticated
USING (public.can_check_in_event(event_id));

-- Allow hosts AND checkers to update RSVPs for check-in (only check-in columns enforced by trigger below)
CREATE POLICY "Hosts and checkers can check in attendees"
ON public.rsvps FOR UPDATE TO authenticated
USING (public.can_check_in_event(event_id))
WITH CHECK (public.can_check_in_event(event_id));

-- Trigger preventing duplicate check-ins and restricting update fields to check-in columns
CREATE OR REPLACE FUNCTION public.rsvps_guard_checkin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow updating check-in-related columns via this guard path; other columns must match
  IF NEW.event_id <> OLD.event_id
     OR NEW.user_id <> OLD.user_id
     OR NEW.ticket_code <> OLD.ticket_code
     OR NEW.status <> OLD.status
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Only check-in fields may be updated through this path';
  END IF;

  -- Prevent duplicate check-in: cannot set checked_in_at when already set
  IF NEW.checked_in_at IS NOT NULL AND OLD.checked_in_at IS NOT NULL THEN
    RAISE EXCEPTION 'Attendee already checked in';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rsvps_guard_checkin ON public.rsvps;
CREATE TRIGGER rsvps_guard_checkin
BEFORE UPDATE ON public.rsvps
FOR EACH ROW EXECUTE FUNCTION public.rsvps_guard_checkin();
