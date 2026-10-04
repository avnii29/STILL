import { runRedTeamAgent } from "@/lib/agents/governance";

export type GatewayAction =
  | "CREATE_REMINDER"
  | "SNOOZE_REMINDER"
  | "MARK_RESOLVED"
  | "OPEN_DOCUMENT"
  | "CREATE_DOCUMENT"
  | "RESCHEDULE_CALENDAR_EVENT"
  | "DRAFT_MESSAGE"
  | "SEND_MESSAGE"
  | "CANCEL_EVENT";

export type GateResult = {
  allowed: boolean;
  status: "READY" | "PAUSED" | "BLOCKED";
  risk: "low" | "medium" | "high";
  reason: string;
  checks: string[];
};

export function actionRisk(kind: GatewayAction): "low" | "medium" | "high" {
  if (kind === "SEND_MESSAGE" || kind === "CANCEL_EVENT") return "high";
  if (kind === "RESCHEDULE_CALENDAR_EVENT" || kind === "CREATE_DOCUMENT" || kind === "DRAFT_MESSAGE") {
    return "medium";
  }
  return "low";
}

export function gateAction(input: {
  kind: GatewayAction;
  evidence: string;
  stillActive: boolean;
  approved: boolean;
  importantEvent?: boolean;
  connectorReady?: boolean;
}): GateResult {
  const risk = actionRisk(input.kind);
  const redTeam = runRedTeamAgent({
    proposal: input.kind,
    evidence: input.evidence,
    stillActive: input.stillActive,
  });
  const checks = [...redTeam.output.checks];

  if (input.kind === "SEND_MESSAGE") {
    return {
      allowed: false,
      status: "BLOCKED",
      risk,
      reason: "STILL does not send messages.",
      checks,
    };
  }
  if (input.kind === "CANCEL_EVENT") {
    return {
      allowed: false,
      status: "BLOCKED",
      risk,
      reason: "Cancelling an event needs a separate confirmation STILL does not offer yet.",
      checks,
    };
  }
  if (input.importantEvent && input.kind === "RESCHEDULE_CALENDAR_EVENT") {
    return {
      allowed: false,
      status: "BLOCKED",
      risk,
      reason: "The event is marked important. STILL will not treat it as lower priority.",
      checks,
    };
  }
  if (!redTeam.output.allowed) {
    return {
      allowed: false,
      status: "BLOCKED",
      risk,
      reason: redTeam.output.blockedReason ?? "The safety check stopped this.",
      checks,
    };
  }
  if (risk !== "low" && !input.approved) {
    return {
      allowed: false,
      status: "PAUSED",
      risk,
      reason: "Waiting for approval.",
      checks,
    };
  }
  if (input.kind === "RESCHEDULE_CALENDAR_EVENT" && input.connectorReady === false) {
    return {
      allowed: false,
      status: "BLOCKED",
      risk,
      reason: "Google Calendar is not connected, so the event was not changed.",
      checks,
    };
  }
  return {
    allowed: true,
    status: "READY",
    risk,
    reason: "Approved and allowed.",
    checks,
  };
}
