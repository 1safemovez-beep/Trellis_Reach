-- Optional example rows so the dashboard isn't empty on day one.
-- Every row is marked example = true; remove them from Settings → Remove example rows.
insert into leads (name, email, business, path, source, stage, value, closer, consent_email, consent_sms_calls, example) values
  ('Maria (example)', 'maria@example.com', 'QVTrellis builds', 'High-stakes client / business', 'AI-scaled ad', 'Won', 1200, 'Alicia', true, true, true),
  ('Devon (example)', 'devon@example.com', 'Seed Loop', 'Builder with an idea', 'Seed Loop member', 'Booked', 0, null, true, true, true),
  ('Priya (example)', 'priya@example.com', 'Responsible AI Check', 'Responsible AI Check', 'PushPilot affiliate', 'Nurture', 0, null, true, false, true),
  ('Jordan (example)', 'jordan@example.com', 'Tool Bazaar', 'App user', 'Creator', 'New', 0, null, true, true, true);

insert into bookings (title, kind, starts_at, who, business, example) values
  ('Booking call with Devon (example)', 'Booking call', now() + interval '1 day', 'Alicia', 'Seed Loop', true),
  ('Seed Loop intro webinar (example)', 'Webinar', now() + interval '3 days', 'Alicia', 'Seed Loop', true);
