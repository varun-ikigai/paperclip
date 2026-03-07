export const type = "opencode_local";
export const label = "OpenCode (local)";

export const models: Array<{ id: string; label: string }> = [
  { id: "openrouter/anthropic/claude-opus-4.6", label: "Claude Opus 4.6" },
  { id: "openrouter/anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
  { id: "openrouter/anthropic/claude-haiku-4.6", label: "Claude Haiku 4.6" },
  { id: "openrouter/minimax/minimax-m2.5", label: "MiniMax M2.5" },
  { id: "openrouter/zhipu/glm-5", label: "GLM 5" },
  { id: "openrouter/google/gemini-3", label: "Gemini 3" },
];

export const agentConfigurationDoc = `# opencode_local agent configuration

Adapter: opencode_local

Use when:
- You want Paperclip to run OpenCode locally as the agent runtime
- You want provider/model routing in OpenCode format (provider/model)
- You want OpenCode session resume across heartbeats via --session

Don't use when:
- You need webhook-style external invocation (use openclaw or http)
- You only need one-shot shell commands (use process)
- OpenCode CLI is not installed on the machine

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file prepended to the run prompt
- model (string, required): OpenCode model id in provider/model format (for example openrouter/anthropic/claude-sonnet-4.6)
- variant (string, optional): provider-specific model variant (for example minimal|low|medium|high|max)
- promptTemplate (string, optional): run prompt template
- command (string, optional): defaults to "opencode"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- OpenCode supports multiple providers and models. Use \
  \`opencode models\` to list available options in provider/model format.
- Paperclip requires an explicit \`model\` value for \`opencode_local\` agents.
- Runs are executed with: opencode run --format json ...
- Sessions are resumed with --session when stored session cwd matches current cwd.

OpenRouter ZDR Models:
- OpenRouter Zero Data Retention (ZDR) models are available as static options in Paperclip.
- When using OpenRouter models, set \`OPENROUTER_API_KEY\` in the env configuration.
- Example env: \`{ "OPENROUTER_API_KEY": "your-api-key" }\`

ZDR Models:
- openrouter/anthropic/claude-opus-4.6 - Claude Opus 4.6
- openrouter/anthropic/claude-sonnet-4.6 - Claude Sonnet 4.6
- openrouter/anthropic/claude-haiku-4.6 - Claude Haiku 4.6
- openrouter/minimax/minimax-m2.5 - MiniMax M2.5
- openrouter/zhipu/glm-5 - GLM 5
- openrouter/google/gemini-3 - Gemini 3
`;
