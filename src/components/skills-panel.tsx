/** @jsxImportSource @opentui/solid */

import { For, Show, createMemo, createSignal } from "solid-js"
import type { Accessor } from "solid-js"
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui"
import type { SkillSummary } from "../skill-data"

const ELLIPSIS = "..."
const ROW_FIXED_WIDTH = 3

function truncateLabel(value: string, maxWidth: number) {
  if (maxWidth <= 0 || value.length <= maxWidth) {
    return maxWidth <= 0 ? "" : value
  }

  if (maxWidth <= ELLIPSIS.length) {
    return ELLIPSIS.slice(0, maxWidth)
  }

  return `${value.slice(0, maxWidth - ELLIPSIS.length)}${ELLIPSIS}`
}

export interface SkillsPanelProps {
  skills: Accessor<SkillSummary[]>
  loadedNames: Accessor<Set<string>>
  hiddenNames: Accessor<Set<string>>
  theme: Accessor<TuiThemeCurrent>
  collapsed: Accessor<boolean>
  onToggle: () => void
  onClearHidden: () => void
}

export function SkillsPanel(props: SkillsPanelProps) {
  const [panelWidth, setPanelWidth] = createSignal(0)
  let panelBox: { width: number } | undefined
  const visibleSkills = createMemo(() => {
    const hidden = props.hiddenNames()
    return props.skills().filter((skill) => !hidden.has(skill.name))
  })
  const orderedSkills = createMemo(() => {
    const loaded = props.loadedNames()

    return [...visibleSkills()].sort((left, right) => {
      const leftLoaded = loaded.has(left.name)
      const rightLoaded = loaded.has(right.name)

      if (leftLoaded !== rightLoaded) {
        return leftLoaded ? -1 : 1
      }

      return left.name.localeCompare(right.name)
    })
  })
  const hiddenList = createMemo(() => {
    const hidden = props.hiddenNames()
    return [...hidden].sort((a, b) => a.localeCompare(b))
  })

  const textColor = createMemo(() => props.theme().text)
  const mutedColor = createMemo(() => props.theme().textMuted)
  const loadedColor = createMemo(() => props.theme().success)
  const unloadedColor = createMemo(() => props.theme().textMuted)
  const loadedCount = createMemo(() => {
    const loaded = props.loadedNames()
    return visibleSkills().filter((skill) => loaded.has(skill.name)).length
  })
  const title = createMemo(() => (props.collapsed() ? "▶ Skills" : "▼ Skills"))
  const headerSummary = createMemo(() => {
    const loaded = loadedCount()
    const hidden = props.hiddenNames().size
    if (hidden === 0) {
      return `(${loaded} loaded)`
    }
    return `(${loaded} loaded, ${hidden} hidden)`
  })

  return (
    <box
      flexDirection="column"
      ref={(element) => {
        panelBox = element
        setPanelWidth(element.width)
      }}
      onSizeChange={() => setPanelWidth(panelBox?.width ?? 0)}
    >
      <box flexDirection="row" columnGap={1} onMouseDown={props.onToggle}>
        <text style={{ fg: textColor() }}>
          <strong>{title()}</strong>
        </text>
        <Show when={props.collapsed()}>
          <text style={{ fg: mutedColor() }}>{headerSummary()}</text>
        </Show>
      </box>

      <Show when={!props.collapsed()}>
        <Show
          when={orderedSkills().length > 0}
          fallback={<text style={{ fg: mutedColor() }}>No skills available</text>}
        >
          <For each={orderedSkills()}>
            {(skill) => {
              const loaded = () => props.loadedNames().has(skill.name)
              const status = () => (loaded() ? "Loaded" : "Unloaded")
              const visibleName = () => {
                if (panelWidth() <= 0) {
                  return skill.name
                }

                return truncateLabel(skill.name, panelWidth() - status().length - ROW_FIXED_WIDTH)
              }

              return (
                <box flexDirection="row" columnGap={1}>
                  <text style={{ fg: loaded() ? loadedColor() : unloadedColor() }}>
                    {"•"}
                  </text>
                  <text style={{ fg: textColor() }}>{visibleName()}</text>
                  <text style={{ fg: mutedColor() }}>{status()}</text>
                </box>
              )
            }}
          </For>
        </Show>

        <Show when={hiddenList().length > 0}>
          <box flexDirection="row" columnGap={1} onMouseDown={props.onClearHidden}>
            <text style={{ fg: mutedColor() }}>
              {`Hidden: ${hiddenList().length} (show all)`}
            </text>
          </box>
        </Show>
      </Show>
    </box>
  )
}
