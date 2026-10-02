import type { AgentMessage, DetectionResult, LanguageModel } from "@/lib/agents/types";
import { runContextAgent } from "@/lib/agents/context-agent";
import { runFutureSelfAgent } from "@/lib/agents/future-self-agent";
import { runSocialContextAgent } from "@/lib/agents/social-context-agent";
import { runSuggestionAgent } from "@/lib/agents/suggestion-agent";
import { detectCommitmentHeuristic } from "@/lib/agents/commitment-detector";
import {
  runActionProposalAgent,
  runEvidenceAgent,
  runFrictionAgent,
  runInterventionAgent,
  runPriorityAgent,
  runRedTeamAgent,
  runRouterAgent,
  runThreadAgent,
} from "@/lib/agents/governance";

export type PipelineThread = DetectionResult & {
  shouldSurface: boolean;
  socialCaution: string;
  suggestionRequiresApproval: boolean;
  wouldContactAnotherHuman: boolean;
  interventionNecessary: boolean;
  smallerAction: string | null;
  redTeamAllowed: boolean;
  redTeamReason?: string;
};

export async function detectThreadsFromMessages(input: {
  messages: AgentMessage[];
  personName?: string;
  model: LanguageModel | null;
}): Promise<PipelineThread[]> {
  const results: PipelineThread[] = [];

  for (const [index, message] of input.messages.entries()) {
    const routed = runRouterAgent(message);
    if (routed.output === "ignore") continue;
    if (!detectCommitmentHeuristic(message)) continue;

    const detection = await runContextAgent({
      message,
      messages: input.messages,
      index,
      personName: input.personName,
      model: input.model,
    });
    if (!detection) continue;

    const evidenced = runEvidenceAgent(detection);
    if (!evidenced.ok) continue;

    const futureAware = runFutureSelfAgent(evidenced.output);
    runPriorityAgent(futureAware);
    runThreadAgent(futureAware);
    const social = await runSocialContextAgent({
      type: futureAware.type,
      confidence: futureAware.confidence,
      evidence: futureAware.evidence,
      context: futureAware.context,
      model: input.model,
    });
    const suggestion = runSuggestionAgent(futureAware);
    const intervention = runInterventionAgent({ detection: futureAware });
    const friction = runFrictionAgent(0, futureAware.evidence);
    const proposal = runActionProposalAgent({
      kind: "NONE",
      target: futureAware.title,
      reason: futureAware.suggested_action,
    });
    const redTeam = runRedTeamAgent({
      proposal: proposal.output.target,
      evidence: futureAware.evidence,
      stillActive: futureAware.is_thread,
    });

    if (!futureAware.is_thread && !futureAware.uncertain && !social.shouldSurface) continue;

    results.push({
      ...futureAware,
      shouldSurface: (social.shouldSurface && futureAware.is_thread) || Boolean(futureAware.uncertain),
      socialCaution: social.caution,
      suggestionRequiresApproval: suggestion.requiresUserApproval,
      wouldContactAnotherHuman: suggestion.wouldContactAnotherHuman,
      suggested_action: suggestion.action,
      interventionNecessary: intervention.output.necessary,
      smallerAction: friction.output.smallerAction,
      redTeamAllowed: redTeam.output.allowed,
      redTeamReason: redTeam.output.blockedReason,
    });
  }

  return results;
}
