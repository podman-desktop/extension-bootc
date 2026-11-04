/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import Stepper from './Stepper.svelte';

const steps = [
  { id: 'image', label: 'Select image' },
  { id: 'output', label: 'Output configuration' },
  { id: 'build', label: 'Build' },
];

test('keep the current step enabled and disable unavailable steps', async () => {
  const onStepClick = vi.fn();
  render(Stepper, { value: 'image', steps: steps.map(step => ({ ...step, disabled: true })), onStepClick });

  const current = screen.getByRole('button', { name: 'Select image', current: 'step' });
  expect(current).toBeEnabled();
  await userEvent.click(current);

  for (const button of screen.getAllByRole('button').filter(button => button !== current)) {
    expect(button).toBeDisabled();
    await userEvent.click(button);
  }

  expect(onStepClick).not.toHaveBeenCalled();
});

test('expose one action per step', () => {
  render(Stepper, { value: 'output', steps, onStepClick: vi.fn() });

  expect(screen.getAllByRole('button')).toHaveLength(steps.length);
  screen.getByRole('navigation', { name: 'Build steps' });
  const list = screen.getByRole('list');
  expect(list.tagName).toBe('OL');
  expect(within(list).getAllByRole('listitem')).toHaveLength(steps.length);
});

test('disable navigation without a callback', async () => {
  render(Stepper, { value: 'output', steps });

  for (const button of screen.getAllByRole('button')) {
    if (button.textContent?.includes('Output configuration')) {
      expect(button).toBeEnabled();
    } else {
      expect(button).toBeDisabled();
    }
  }
});

test('return to a completed step', async () => {
  const onStepClick = vi.fn();
  render(Stepper, { value: 'output', steps, onStepClick });

  const target = screen.getByRole('button', { name: 'Select image' });
  expect(target).toHaveAccessibleDescription('Completed');
  expect(within(target).queryByText('1')).not.toBeInTheDocument();
  await userEvent.click(target);

  expect(onStepClick).toHaveBeenCalledExactlyOnceWith(steps[0]);
  expect(screen.getByRole('button', { name: 'Output configuration', current: 'step' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Build' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Build' })).not.toHaveAccessibleDescription('Completed');
});

test('select an available future step with its typed object', async () => {
  const onStepClick = vi.fn();
  render(Stepper, { value: 'image', steps, onStepClick });

  await userEvent.click(screen.getByRole('button', { name: 'Build' }));

  expect(onStepClick).toHaveBeenCalledExactlyOnceWith(steps[2]);
});
