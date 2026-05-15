import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { Part } from "@opencode-ai/sdk/v2"

export interface SkillSummary {
  name: string
  description: string
  location: string
}

export async function loadAvailableSkills(api: TuiPluginApi): Promise<SkillSummary[]> {
  const result = await api.client.app.skills({
    directory: api.state.path.directory,
  })

  const entries = result.data ?? []
  const deduped = new Map<string, SkillSummary>()

  for (const entry of entries) {
    if (!deduped.has(entry.name)) {
      deduped.set(entry.name, {
        name: entry.name,
        description: entry.description ?? "",
        location: entry.location ?? "",
      })
    }
  }

  return [...deduped.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function extractLoadedSkillName(part: Part): string | undefined {
  if (part.type !== "tool" || part.tool !== "skill") {
    return undefined
  }

  const candidate = part.state.input?.name
  return typeof candidate === "string" && candidate.length > 0 ? candidate : undefined
}

export function collectLoadedSkillsForSession(api: TuiPluginApi, sessionID: string): Set<string> {
  const loaded = new Set<string>()

  for (const message of api.state.session.messages(sessionID)) {
    for (const part of api.state.part(message.id)) {
      const skillName = extractLoadedSkillName(part)
      if (skillName) {
        loaded.add(skillName)
      }
    }
  }

  return loaded
}
