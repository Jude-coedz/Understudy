import { getIdentity } from "@/lib/personal-workspace";
import { getSupabaseSession, getSupabaseUser, signInWithSupabaseGoogle, supabaseRest } from "@/lib/supabase-browser";

export type WorkspaceMember = {
  workspace_id: string;
  user_id: string;
  role: "viewer" | "editor";
  member_email?: string | null;
  member_name?: string | null;
  created_at: string;
};

export type WorkspaceInvite = {
  token: string;
  expires_at: string;
  role: "viewer" | "editor";
};

export async function currentAccountUser() {
  const session = await getSupabaseSession();
  return getSupabaseUser(session);
}

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const response = await supabaseRest(
    `workspace_members?select=workspace_id,user_id,role,member_email,member_name,created_at&workspace_id=eq.${encodeURIComponent(workspaceId)}&order=created_at.asc`,
  );
  if (!response.ok) throw new Error("Could not load workspace members.");
  return (await response.json()) as WorkspaceMember[];
}

export async function createWorkspaceInvite(
  workspaceId: string,
  role: "viewer" | "editor",
): Promise<WorkspaceInvite> {
  const response = await supabaseRest("rpc/create_workspace_invite", {
    method: "POST",
    body: JSON.stringify({ p_workspace_id: workspaceId, p_role: role }),
  });
  const payload = (await response.json()) as WorkspaceInvite[] | { message?: string };
  if (!response.ok || !Array.isArray(payload) || !payload[0]?.token) {
    const detail = !Array.isArray(payload) ? payload.message : undefined;
    throw new Error(detail || "Could not create a workspace invite.");
  }
  return payload[0];
}

export async function acceptWorkspaceInvite(token: string) {
  const response = await supabaseRest("rpc/accept_workspace_invite", {
    method: "POST",
    body: JSON.stringify({ p_token: token }),
  });
  const payload = (await response.json()) as Array<{ workspace_id: string; role: "viewer" | "editor" }> | { message?: string };
  if (!response.ok || !Array.isArray(payload) || !payload[0]?.workspace_id) {
    const detail = !Array.isArray(payload) ? payload.message : undefined;
    throw new Error(detail || "This invite is invalid, expired, or already used.");
  }
  return payload[0];
}

export async function updateWorkspaceMemberRole(workspaceId: string, userId: string, role: "viewer" | "editor") {
  const response = await supabaseRest(
    `workspace_members?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ role }),
    },
  );
  if (!response.ok) throw new Error("Could not update this member's access.");
}

export async function removeWorkspaceMember(workspaceId: string, userId: string) {
  const response = await supabaseRest(
    `workspace_members?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error("Could not remove this member.");
}

export async function signInForInvite(token: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("understudy:post-auth-return:v1", `/join?token=${encodeURIComponent(token)}`);
  }
  await signInWithSupabaseGoogle();
}

export function consumePostAuthReturn() {
  if (typeof window === "undefined") return null;
  const key = "understudy:post-auth-return:v1";
  const value = window.localStorage.getItem(key);
  if (value) window.localStorage.removeItem(key);
  return value;
}

export function currentIdentityIsOwner(ownerId: string) {
  return getIdentity().provider === "account" && getIdentity().id === ownerId;
}
