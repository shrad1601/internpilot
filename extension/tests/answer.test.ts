import { describe, it, expect } from 'vitest'
import { answerToAction } from '../src/background/runMachine'

describe('answerToAction', () => {
  it('chooses a radio option for radio groups', () => {
    expect(answerToAction('radio_group', 'a', 'No')).toEqual({ type: 'choose_radio', agentId: 'a', optionLabel: 'No' })
  })
  it('selects an option for selects', () => {
    expect(answerToAction('select', 'a', 'Singapore')).toEqual({ type: 'select', agentId: 'a', optionLabel: 'Singapore' })
  })
  it('maps yes/no to a checkbox state', () => {
    expect(answerToAction('checkbox', 'a', 'Yes')).toEqual({ type: 'check', agentId: 'a', checked: true })
    expect(answerToAction('checkbox', 'a', 'No')).toEqual({ type: 'check', agentId: 'a', checked: false })
  })
  it('types text for everything else', () => {
    expect(answerToAction('text', 'a', 'hi')).toEqual({ type: 'fill', agentId: 'a', value: 'hi' })
    expect(answerToAction(undefined, 'a', 'hi')).toEqual({ type: 'fill', agentId: 'a', value: 'hi' })
  })
})
