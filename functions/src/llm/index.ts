/**
 * Public API of the provider-agnostic LLM layer. The controller imports the
 * three task functions from here; internally they route across providers with
 * global rate-aware distribution + failover.
 */
export {
  generateLocationConcepts,
  generateSidequestsWriter,
  generateGenericSidequests,
  planDescribedSidequest,
} from "./tasks";

export type { LogContext } from "./tasks";
