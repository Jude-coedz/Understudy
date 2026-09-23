"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { blankTransition, createWorkspace, saveWorkspace } from "@/lib/personal-workspace";
import { IconChevronRight } from "./icons";
import { UnderstudyMark } from "./understudy-mark";
import { UnderstudySelect } from "./understudy-select";

type Errors = Partial<Record<"person" | "role" | "department" | "successor" | "targetDate", string>>;

export function NewHandoffFlow() {
  const reducedMotion = useReducedMotion();
  const [person, setPerson] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [successor, setSuccessor] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [type, setType] = useState("Role transition");
  const [errors, setErrors] = useState<Errors>({});

  const formattedDate = useMemo(() => {
    if (!targetDate) return "";
    const parsed = new Date(`${targetDate}T12:00:00`);
    return Number.isNaN(parsed.valueOf()) ? targetDate : parsed.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
  }, [targetDate]);

  function create() {
    const next: Errors = {};
    if (!person.trim()) next.person = "Add the person handing over the work.";
    if (!role.trim()) next.role = "Add the role being handed over.";
    if (!department.trim()) next.department = "Add the team or department.";
    if (!successor.trim()) next.successor = "Add the next owner, or use a team name.";
    if (!targetDate) next.targetDate = "Choose the target handoff date.";
    setErrors(next);
    if (Object.keys(next).length) return;

    const transition = blankTransition({
      person: person.trim(),
      role: role.trim(),
      department: department.trim(),
      successor: successor.trim(),
      targetDate: formattedDate,
      type,
    });
    const workspace = createWorkspace(transition);
    saveWorkspace(workspace);
    window.location.assign("/workspace");
  }

  const field = (name: keyof Errors, label: string, value: string, setter: (value: string) => void, placeholder: string) => (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        value={value}
        onChange={(event) => { setter(event.target.value); setErrors((current) => ({ ...current, [name]: undefined })); }}
        placeholder={placeholder}
        className={`mt-2 h-12 w-full rounded-xl border bg-card px-3.5 text-sm outline-none ${errors[name] ? "border-danger" : "border-border focus:border-border-strong"}`}
      />
      {errors[name] && <span className="mt-1.5 block text-xs text-danger">{errors[name]}</span>}
    </label>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-medium"><UnderstudyMark size={32} />Understudy</Link>
          <Link href="/handoffs" className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted hover:bg-card-hover">My handoffs</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 lg:px-8 lg:py-14">
        <motion.div initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">New handoff</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Whose work is changing hands?</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">Set the boundary once. On the next screen you can add files, paste work, choose Drive files, recover AI context, or combine all four.</p>

          <div className="mt-8 grid gap-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2 sm:p-6">
            {field("person", "Person handing over", person, setPerson, "e.g. Joe Adams")}
            {field("role", "Role", role, setRole, "e.g. Product Manager")}
            {field("department", "Team / department", department, setDepartment, "e.g. Product")}
            {field("successor", "Next owner", successor, setSuccessor, "e.g. Priya or Product team")}
            <label className="block">
              <span className="text-sm font-medium">Transition type</span>
              <div className="mt-2">
                <UnderstudySelect
                  value={type}
                  options={["Role transition", "Departure", "Leave coverage", "Team reallocation"]}
                  onChange={setType}
                  label="Transition type"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Target handoff date</span>
              <input type="date" value={targetDate} onChange={(event) => { setTargetDate(event.target.value); setErrors((current) => ({ ...current, targetDate: undefined })); }} className={`mt-2 h-12 w-full rounded-xl border bg-card px-3.5 text-sm outline-none ${errors.targetDate ? "border-danger" : "border-border"}`} />
              {errors.targetDate && <span className="mt-1.5 block text-xs text-danger">{errors.targetDate}</span>}
            </label>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/handoffs" className="text-sm font-medium text-subtle hover:text-muted">← Back to my handoffs</Link>
            <motion.button whileTap={reducedMotion ? undefined : { scale: 0.98 }} onClick={create} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-medium text-white shadow-sm">Continue to evidence <IconChevronRight /></motion.button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
