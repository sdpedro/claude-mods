import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Window } from '../types'

const windows = atom({ plugin: 'usage-band', key: 'windows' } as const, [] as Window[])

const LABELS: Record<string, string> = { five_hour: 'Atual (5h)', seven_day: 'Semanal' }
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const pad = (n: number) => String(n).padStart(2, '0')

// Same window as the CLI status line: time only for the 5h one, date and time for the weekly one
const formatReset = (kind: string, iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return kind === 'five_hour' ? time : `${d.getDate()} ${MONTHS[d.getMonth()]}, ${time}`
}

const bar = (percent: number) => {
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)))
  return '●'.repeat(filled) + '○'.repeat(10 - filled)
}

const colorFor = (percent: number) => (percent >= 90 ? 'red' : percent >= 70 ? 'yellow' : 'green')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const { rateLimits } = await $.session.usage()
    await update($, windows, () => rateLimits)
    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      await update($, windows, () => e.rateLimits)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const shown = (await read($, windows)).filter(w => w.kind in LABELS)
    if (e.props.hasSurvey || shown.length === 0) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {shown.map(w => (
          <Box key={w.kind}>
            <Text dimColor>{(LABELS[w.kind] ?? w.kind).padEnd(11)}</Text>
            <Text color={colorFor(w.percentUsed)} mono>
              {bar(w.percentUsed)}
            </Text>
            <Text tabular> {Math.round(w.percentUsed)}%</Text>
            <Text dimColor> · renova {formatReset(w.kind, w.resetsAt)}</Text>
          </Box>
        ))}
      </Box>
    )
  })
}
