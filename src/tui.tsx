/** @jsxImportSource @opentui/solid */

import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createSignal } from "solid-js"
import { SkillsPanel } from "./components/skills-panel"
import { SkillsStatusDialog } from "./components/skills-status-dialog"
import {
  collectLoadedSkillsForSession,
  extractLoadedSkillName,
  loadAvailableSkills,
  type SkillSummary,
} from "./skill-data"

const SIDEBAR_ORDER = 250
const COLLAPSED_KEY = "opencode-skills-sidebar.collapsed"

const tui: TuiPlugin = async (api) => {
  const [skills, setSkills] = createSignal<SkillSummary[]>([])
  const [loadVersion, setLoadVersion] = createSignal(0)
  const [collapsed, setCollapsed] = createSignal(Boolean(api.kv.get(COLLAPSED_KEY, false)))
  const loadedBySession = new Map<string, Set<string>>()
  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  const loadedRefreshTimers = new Set<ReturnType<typeof setTimeout>>()
  let visibleSessionID: string | undefined

  const getActiveSessionID = () => {
    const currentRoute = api.route.current
    const candidate = "params" in currentRoute ? currentRoute.params?.sessionID : undefined

    if (currentRoute.name === "session" && typeof candidate === "string") {
      return candidate
    }

    return visibleSessionID
  }

  const toggleCollapsed = () => {
    const next = !collapsed()
    setCollapsed(next)
    api.kv.set(COLLAPSED_KEY, next)
  }

  const getLoadedSkills = (sessionID: string) => {
    let loaded = loadedBySession.get(sessionID)

    if (!loaded) {
      loaded = collectLoadedSkillsForSession(api, sessionID)
      loadedBySession.set(sessionID, loaded)
    }

    return loaded
  }

  const refreshLoadedSkills = (sessionID: string) => {
    const next = collectLoadedSkillsForSession(api, sessionID)
    const previous = loadedBySession.get(sessionID)

    if (
      previous &&
      previous.size === next.size &&
      [...next].every((skillName) => previous.has(skillName))
    ) {
      return
    }

    loadedBySession.set(sessionID, next)
    setLoadVersion((value) => value + 1)
  }

  const scheduleRefreshLoadedSkills = (sessionID: string, delay = 0) => {
    const timer = setTimeout(() => {
      loadedRefreshTimers.delete(timer)
      refreshLoadedSkills(sessionID)
    }, delay)

    loadedRefreshTimers.add(timer)
  }

  const scheduleSessionOpenRefresh = (sessionID: string) => {
    // Session history can hydrate just after navigation, so retry shortly
    // after selection to backfill skills before the next prompt is sent.
    scheduleRefreshLoadedSkills(sessionID)
    scheduleRefreshLoadedSkills(sessionID, 150)
    scheduleRefreshLoadedSkills(sessionID, 500)
  }

  const markLoaded = (sessionID: string, skillName: string) => {
    const loaded = getLoadedSkills(sessionID)
    const sizeBefore = loaded.size

    loaded.add(skillName)

    if (loaded.size !== sizeBefore) {
      setLoadVersion((value) => value + 1)
    }
  }

  const refreshSkills = async () => {
    try {
      setSkills(await loadAvailableSkills(api))
    } catch (error) {
      api.ui.toast({
        variant: "error",
        title: "Skills Sidebar",
        message: `Failed to load skills: ${error instanceof Error ? error.message : String(error)}`,
        duration: 5000,
      })
    }
  }

  const scheduleRefreshSkills = (delay = 0) => {
    if (refreshTimer) {
      clearTimeout(refreshTimer)
    }

    refreshTimer = setTimeout(() => {
      refreshTimer = undefined
      void refreshSkills()
    }, delay)
  }

  await refreshSkills()

  // OpenCode may initialize TUI plugins before workspace/worktree state is fully ready.
  // Refresh after readiness events so skill discovery does not get stuck empty.
  scheduleRefreshSkills(250)

  const unregisterMessagePartUpdated = api.event.on("message.part.updated", (event) => {
    const skillName = extractLoadedSkillName(event.properties.part)
    if (skillName) {
      markLoaded(event.properties.sessionID, skillName)
    }
  })

  const unregisterMessageUpdated = api.event.on("message.updated", (event) => {
    refreshLoadedSkills(event.properties.sessionID)
  })

  const unregisterSessionDeleted = api.event.on("session.deleted", (event) => {
    loadedBySession.delete(event.properties.sessionID)
    setLoadVersion((value) => value + 1)
  })

  const unregisterSessionCreated = api.event.on("session.created", () => {
    scheduleRefreshSkills()
  })

  const unregisterSessionUpdated = api.event.on("session.updated", (event) => {
    refreshLoadedSkills(event.properties.sessionID)
  })

  const unregisterProjectUpdated = api.event.on("project.updated", () => {
    scheduleRefreshSkills()
  })

  const unregisterWorkspaceReady = api.event.on("workspace.ready", () => {
    scheduleRefreshSkills()
  })

  const unregisterWorktreeReady = api.event.on("worktree.ready", () => {
    scheduleRefreshSkills()
  })

  const unregisterCommand = api.command?.register(() => [
    {
      title: "Skills Status",
      value: "skills-status",
      description: "Show all skills and loaded state",
      category: "Skills",
      slash: { name: "skills-status" },
      onSelect: (dialog) => {
        const sessionID = getActiveSessionID()
        if (!dialog || !sessionID) {
          api.ui.toast({
            variant: "warning",
            title: "Skills Sidebar",
            message: "Open a session before using /skills-status.",
            duration: 4000,
          })
          return
        }

        scheduleSessionOpenRefresh(sessionID)
        dialog.setSize("medium")
        dialog.replace(() => (
          <SkillsStatusDialog
            skills={skills}
            loadedNames={() => getLoadedSkills(sessionID)}
            theme={() => api.theme.current}
            version={loadVersion}
          />
        ))
      },
    },
  ])

  api.lifecycle.onDispose(() => {
    if (refreshTimer) {
      clearTimeout(refreshTimer)
    }

    for (const timer of loadedRefreshTimers) {
      clearTimeout(timer)
    }

    loadedRefreshTimers.clear()

    unregisterMessagePartUpdated()
    unregisterMessageUpdated()
    unregisterSessionDeleted()
    unregisterSessionCreated()
    unregisterSessionUpdated()
    unregisterProjectUpdated()
    unregisterWorkspaceReady()
    unregisterWorktreeReady()
    unregisterCommand?.()
  })

  api.slots.register({
    order: SIDEBAR_ORDER,
    slots: {
      sidebar_content: (_ctx, props) => {
        if (visibleSessionID !== props.session_id) {
          visibleSessionID = props.session_id
          scheduleSessionOpenRefresh(props.session_id)
        }

        loadVersion()

        return (
          <SkillsPanel
            skills={skills}
            loadedNames={() => getLoadedSkills(props.session_id)}
            theme={() => api.theme.current}
            collapsed={collapsed}
            onToggle={toggleCollapsed}
          />
        )
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: "opencode-skills-sidebar",
  tui,
}

export default plugin
