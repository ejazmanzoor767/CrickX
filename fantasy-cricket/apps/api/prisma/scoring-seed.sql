-- Example starting ScoringRuleSet — adjust to your product's actual rules.
-- Run manually or via a Prisma seed script; not auto-applied by migrations.
INSERT INTO "ScoringRuleSet" (id, name, "matchType", "isActive", rules, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Standard T20',
  'T20I',
  true,
  '{"run":1,"four_bonus":1,"six_bonus":2,"half_century_bonus":8,"century_bonus":16,"duck_penalty":-2,"wicket":25,"three_wicket_bonus":4,"five_wicket_bonus":8,"maiden_over":4,"catch":8,"stumping":12,"run_out":6,"captain_multiplier":2,"vice_captain_multiplier":1.5}'::jsonb,
  now(),
  now()
);
