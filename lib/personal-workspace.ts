import type { Transition } from "@/data/v2-demo";
import type { RoleEvidenceModel } from "@/lib/role-evidence";
import type { SuccessorReview } from "@/lib/successor-review";

export type UnderstudyIdentity = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  provider: "google" | "guest" | "account";
};

export type InterviewGapDisposition =
  | "deferred"
  | "unknown"
  | "ask-someone"
  | "not-relevant";

export type InterviewGapState = {
  status: InterviewGapDisposition;
  updatedAt: string;
};

export type PersonalWorkspace = {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  transition: Transition;
  sourceBodies: Record<string, string>;
  sourceReviewNotes: Record<string, string>;
  reviewedSourceIds: string[];
  evidenceCollectionComplete: boolean;
  evidenceCollectionCompletedAt?: string;
  interviewGapStates: Record<string, InterviewGapState>;
  interviewCompletedAt?: string;
  roleEvidence?: RoleEvidenceModel;
  successorReview?: SuccessorReview;
};

const IDENTITY_KEY = "understudy:identity:v1";
const GUEST_ID_KEY = "understudy:guest-id:v1";

function browser() {
  return typeof window !== "undefined";
}

function getGuestId() {
  if (!browser()) return "guest";
  let id = window.localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = `guest-${crypto.randomUUID()}`;
    window.localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

export function getIdentity(): UnderstudyIdentity {
  if (!browser()) return { id: "guest", name: "Guest", provider: "guest" };
  const raw = window.localStorage.getItem(IDENTITY_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as UnderstudyIdentity;
      if (parsed?.id && parsed?.name) return parsed;
    } catch {
      // Ignore invalid local data and create a guest identity below.
    }
  }
  return { id: getGuestId(), name: "Guest", provider: "guest" };
}

export function saveIdentity(identity: UnderstudyIdentity) {
  if (!browser()) return;
  window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  window.dispatchEvent(new CustomEvent("understudy:identity-changed", { detail: identity }));
}

export function clearIdentity() {
  if (!browser()) return;
  window.localStorage.removeItem(IDENTITY_KEY);
  window.dispatchEvent(new CustomEvent("understudy:identity-changed"));
}

function workspaceKey(ownerId = getIdentity().id) {
  return `understudy:workspaces:v1:${ownerId}`;
}

function currentKey(ownerId = getIdentity().id) {
  return `understudy:current-workspace:v1:${ownerId}`;
}

function normalizeWorkspace(workspace: PersonalWorkspace): PersonalWorkspace {
  return {
    ...workspace,
    sourceBodies: workspace.sourceBodies ?? {},
    sourceReviewNotes: workspace.sourceReviewNotes ?? {},
    reviewedSourceIds: workspace.reviewedSourceIds ?? [],
    evidenceCollectionComplete: Boolean(workspace.evidenceCollectionComplete),
    interviewGapStates: workspace.interviewGapStates ?? {},
    interviewCompletedAt: workspace.interviewCompletedAt,
    roleEvidence: workspace.roleEvidence,
    successorReview: workspace.successorReview,
  };
}

export function loadWorkspaces(ownerId = getIdentity().id): PersonalWorkspace[] {
  if (!browser()) return [];
  const raw = window.localStorage.getItem(workspaceKey(ownerId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PersonalWorkspace[];
    return Array.isArray(parsed) ? parsed.map(normalizeWorkspace) : [];
  } catch {
    return [];
  }
}

export function saveWorkspace(workspace: PersonalWorkspace) {
  if (!browser()) return;
  const normalized = normalizeWorkspace(workspace);
  const workspaces = loadWorkspaces(normalized.ownerId);
  const next = [normalized, ...workspaces.filter((item) => item.id !== normalized.id)];
  window.localStorage.setItem(workspaceKey(normalized.ownerId), JSON.stringify(next));
  window.localStorage.setItem(currentKey(normalized.ownerId), normalized.id);
  window.dispatchEvent(new CustomEvent("understudy:workspace-saved", { detail: normalized }));
}

export function setCurrentWorkspace(id: string, ownerId = getIdentity().id) {
  if (!browser()) return;
  window.localStorage.setItem(currentKey(ownerId), id);
}

export function getCurrentWorkspace(ownerId = getIdentity().id): PersonalWorkspace | null {
  if (!browser()) return null;
  const workspaces = loadWorkspaces(ownerId);
  const currentId = window.localStorage.getItem(currentKey(ownerId));
  return workspaces.find((workspace) => workspace.id === currentId) ?? workspaces[0] ?? null;
}

export function blankTransition(input: {
  person: string;
  role: string;
  department: string;
  successor: string;
  targetDate: string;
  type: string;
}): Transition {
  const initials = input.person
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
  const successorInitials = input.successor
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

  return {
    id: `transition-${crypto.randomUUID()}`,
    person: input.person,
    initials,
    role: input.role,
    department: input.department,
    type: input.type,
    targetDate: input.targetDate,
    successor: input.successor,
    successorInitials,
    manager: "Not added yet",
    readiness: 0,
    status: "Needs attention",
    summary: "Add real work evidence so Understudy can reconstruct this role before the handoff.",
    metrics: [
      { label: "Responsibilities", value: 0, note: "No evidence yet" },
      { label: "Active work", value: 0, note: "No evidence yet" },
      { label: "Decisions", value: 0, note: "No evidence yet" },
      { label: "Tacit knowledge", value: 0, note: "No interview yet" },
      { label: "Ownership", value: 0, note: "Not mapped" },
      { label: "Successor review", value: 0, note: "Not reviewed" },
    ],
    sources: [],
    projects: [],
    risks: [],
    gaps: [],
  };
}

export function createWorkspace(transition: Transition): PersonalWorkspace {
  const identity = getIdentity();
  const now = new Date().toISOString();
  return {
    id: `workspace-${crypto.randomUUID()}`,
    ownerId: identity.id,
    createdAt: now,
    updatedAt: now,
    transition,
    sourceBodies: {},
    sourceReviewNotes: {},
    reviewedSourceIds: [],
    evidenceCollectionComplete: false,
    interviewGapStates: {},
  };
}
