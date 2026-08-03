import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ActionDialog } from './Dialogs'

describe('ActionDialog', () => {
  it('kræver både begrundelse og eksplicit bekræftelse ved destruktive handlinger', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<ActionDialog open onOpenChange={vi.fn()} action="remove_listing" onConfirm={onConfirm} />)
    const submit = screen.getByRole('button', { name: 'Bekræft handling' })
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText(/Begrundelse/), 'Overtræder reglerne')
    expect(submit).toBeDisabled()
    await user.click(screen.getByRole('checkbox'))
    await user.click(submit)
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('viser mutationsfejl i dialogen', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValue(new Error('Databasefejl'))
    render(<ActionDialog open onOpenChange={vi.fn()} action="warn_user" onConfirm={onConfirm} />)
    await user.type(screen.getByLabelText(/Begrundelse/), 'Konkret årsag')
    await user.click(screen.getByRole('button', { name: 'Bekræft handling' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Databasefejl')
  })
})
