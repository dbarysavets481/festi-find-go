
-- Hosts table
CREATE TABLE public.hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  name text NOT NULL,
  logo_url text,
  bio text,
  contact_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts are viewable by everyone" ON public.hosts
  FOR SELECT USING (true);
CREATE POLICY "Users can create their own host" ON public.hosts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own host" ON public.hosts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own host" ON public.hosts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Event extensions
ALTER TABLE public.events
  ADD COLUMN host_id uuid REFERENCES public.hosts(id) ON DELETE SET NULL,
  ADD COLUMN status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  ADD COLUMN visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','unlisted')),
  ADD COLUMN is_paid boolean NOT NULL DEFAULT false;

-- Backfill: existing seeded events should remain visible
UPDATE public.events SET status = 'published', visibility = 'public';

-- Replace public SELECT policy: published + public visible to everyone; unlisted accessible by direct id query as well
DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;
CREATE POLICY "Published events are viewable by everyone" ON public.events
  FOR SELECT USING (status = 'published');

-- Hosts can view their own drafts
CREATE POLICY "Hosts can view their own events" ON public.events
  FOR SELECT TO authenticated USING (auth.uid() = created_by);

-- Timestamp trigger for hosts
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER hosts_touch_updated_at
  BEFORE UPDATE ON public.hosts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
