import {
  getIdentity,
  loadWorkspaces,
  saveIdentity,
  saveWorkspace,
  setCurrentWorkspace,
  type PersonalWorkspace,
  type UnderstudyIdentity,
} from "@/lib/personal-workspace";
import {
  getSupabaseSession,
  getSupabaseUser,
  supabaseRest,
  type SupabaseUser,
} from "@/lib/supabase-browser";

type CloudWorkspaceRow = {
  id: string;
  owner_id: string;
  payload: PersonalWorkspace;
  updated_at: string;
};

function accountIdentity(user: SupabaseUser): UnderstudyIdentity {
  const metadata = user.user_metadata ?? {};
  const name =
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    user.email?.split("@")[0] ||
    "Understudy user";
  return { id: user.id, name, email: user.email, provider: "account" };
}

function newest(a: PersonalWorkspace, b: PersonalWorkspace) {
  return new Date(a.updatedAt).valueOf() >= new Date(b.updatedAt).valueOf() ? a : b;
}

function withOwner(workspace: PersonalWorkspace, ownerId: string): PersonalWorkspace {
  return { ...workspace, ownerId };
}

export async function pushWorkspaceToCloud(workspace: PersonalWorkspace) {
  const session = await getSupabaseSession();
  const user = await getSupabaseUser(session);
  if (!session || !user) return false;

  const owner = workspace.ownerId || user.id;
  const payload = withOwner(workspace, owner);
  const isOwner = owner === user.id;
  const response = isOwner
    ? await supabaseRest("workspaces?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          id: payload.id,
          owner_id: owner,
          payload,
          created_at: payload.createdAt,
          updated_at: payload.updatedAt,
        }),
      })
    : await supabaseRest(`workspaces?id=eq.${encodeURIComponent(payload.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ payload, updated_at: payload.updatedAt }),
      });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || "Could not sync this workspace to the account.");
  }
  return true;
}

export async function fetchCloudWorkspaces(): Promise<PersonalWorkspace[]> {
  const session = await getSupabaseSession();
  const user = await getSupabaseUser(session);
  if (!session || !user) return [];
  const response = await supabaseRest(
    "workspaces?select=id,owner_id,payload,updated_at&order=updated_at.desc",
  );
  if (!response.ok) throw new Error("Could not load synced workspaces.");
  const rows = (await response.json()) as CloudWorkspaceRow[];
  return rows
    .filter((row) => Boolean(row.payload?.id && row.payload?.transition))
    .map((row) => withOwner(row.payload, row.owner_id));
}

export async function hydrateAuthenticatedWorkspaces() {
  const session = await getSupabaseSession();
  const user = await getSupabaseUser(session);
  if (!session || !user) return null;

  const previousIdentity = getIdentity();
  const previousLocal = loadWorkspaces(previousIdentity.id);
  const remote = await fetchCloudWorkspaces();
  const byId = new Map<string, PersonalWorkspace>();

  remote.forEach((workspace) => byId.set(workspace.id, workspace));
  const migratingAnonymousWorkspace =
    previousIdentity.provider !== "account" || previousIdentity.id !== user.id;

  previousLocal.forEach((workspace) => {
    const migrated = migratingAnonymousWorkspace ? withOwner(workspace, user.id) : workspace;
    const existing = byId.get(migrated.id);
    byId.set(migrated.id, existing ? newest(existing, migrated) : migrated);
  });

  const identity = accountIdentity(user);
  saveIdentity(identity);
  const merged = [...byId.values()].sort(
    (a, b) => new Date(b.updatedAt).valueOf() - new Date(a.updatedAt).valueOf(),
  );

  for (const workspace of merged) {
    saveWorkspace(workspace);
    if (workspace.ownerId === user.id || previousLocal.some((item) => item.id === workspace.id)) {
      await pushWorkspaceToCloud(workspace).catch(() => false);
    }
  }
  if (merged[0]) setCurrentWorkspace(merged[0].id, user.id);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("understudy:cloud-hydrated"));
  }
  return { identity, workspaces: merged };
}
