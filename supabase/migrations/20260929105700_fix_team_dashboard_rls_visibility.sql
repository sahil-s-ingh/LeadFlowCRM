/*
# Fix Team Dashboard RLS — allow owner to see team members' activities and follow-ups

## Problem
The Team Dashboard loads from `lead_activities` and `lead_followups`, but both tables
have SELECT policies scoped to `auth.uid() = user_id`. Team members create activities
and follow-ups under their own `user_id`, so the team owner (who is logged in as a
different `auth.uid()`) gets zero rows back — the dashboard shows "No recent activity"
for every agent and follow-up counts are always 0.

## Fix
Add an additional SELECT policy on both tables that lets the team owner read rows
belonging to any user who is a member of the owner's team. The owner's team members
are identified by joining `team_members` on `owner_id = auth.uid()`.

## Changes
1. `lead_activities` — new SELECT policy `select_team_owner_activities`
2. `lead_followups` — new SELECT policy `select_team_owner_followups`
Both use `EXISTS (SELECT 1 FROM team_members tm WHERE tm.owner_id = auth.uid() AND tm.id = lead_activities.assigned_to_member_id)`
But since lead_activities doesn't have an `assigned_to_member_id` column, we match
through the lead: activities and follow-ups are visible to the owner if the lead's
owner (`submissions.user_id`) matches `auth.uid()`, OR if the activity/followup
`user_id` matches a team member of the current user.

Simpler approach: the owner can see any activity/followup whose `user_id` is either
themselves OR any member of their team (identified by `team_members.owner_id = auth.uid()`).
*/

-- lead_activities: allow team owner to see activities created by their team members
DROP POLICY IF EXISTS "select_team_owner_activities" ON lead_activities;
CREATE POLICY "select_team_owner_activities"
ON lead_activities FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.owner_id = auth.uid()
    AND tm.id = user_id
  )
  OR EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.owner_id = auth.uid()
    AND tm.email = (auth.jwt() ->> 'email')
    AND user_id = tm.owner_id
  )
);

-- lead_followups: allow team owner to see follow-ups created by their team members
DROP POLICY IF EXISTS "select_team_owner_followups" ON lead_followups;
CREATE POLICY "select_team_owner_followups"
ON lead_followups FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.owner_id = auth.uid()
    AND tm.id = user_id
  )
  OR EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.owner_id = auth.uid()
    AND tm.email = (auth.jwt() ->> 'email')
    AND user_id = tm.owner_id
  )
);
