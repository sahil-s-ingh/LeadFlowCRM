/*
# Fix Team Dashboard RLS — allow owner to see team members' activities and follow-ups

## Problem
The Team Dashboard loads from `lead_activities` and `lead_followups`, but both tables
have SELECT policies scoped to `auth.uid() = user_id`. Team members create activities
and follow-ups under their own `user_id`, so the team owner (who has a different
`auth.uid()`) gets zero rows back — the dashboard shows "No recent activity" for
every agent and follow-up counts are always 0.

## Fix
Allow the team owner to see activities and follow-ups for leads that are assigned
to any of their team members (via `submissions.assigned_to = team_members.id` where
`team_members.owner_id = auth.uid()`), in addition to their own.

## Changes
1. `lead_activities` — new SELECT policy `select_team_owner_activities`
2. `lead_followups` — new SELECT policy `select_team_owner_followups`
*/

-- lead_activities: allow team owner to see activities for leads assigned to their team
DROP POLICY IF EXISTS "select_team_owner_activities" ON lead_activities;
CREATE POLICY "select_team_owner_activities"
ON lead_activities FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM submissions s
    JOIN team_members tm ON tm.id = s.assigned_to
    WHERE s.id = lead_activities.lead_id
    AND tm.owner_id = auth.uid()
  )
);

-- lead_followups: allow team owner to see follow-ups for leads assigned to their team
DROP POLICY IF EXISTS "select_team_owner_followups" ON lead_followups;
CREATE POLICY "select_team_owner_followups"
ON lead_followups FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM submissions s
    JOIN team_members tm ON tm.id = s.assigned_to
    WHERE s.id = lead_followups.lead_id
    AND tm.owner_id = auth.uid()
  )
);
