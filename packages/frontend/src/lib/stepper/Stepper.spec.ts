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

import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import Stepper from './Stepper.svelte';

const steps = [
  { id: 'image', label: 'Select image' },
  { id: 'output', label: 'Output configuration' },
  { id: 'build', label: 'Build' },
];

test('disable the current step and unavailable steps', async () => {
  const onStepClick = vi.fn();
  render(Stepper, { value: 'image', steps: steps.map(step => ({ ...step, disabled: true })), onStepClick });

  for (const button of screen.getAllByRole('button')) {
    expect(button).toBeDisabled();
    await userEvent.click(button);
  }

  expect(onStepClick).not.toHaveBeenCalled();
});

test('expose one action per step', () => {
  render(Stepper, { value: 'output', steps, onStepClick: vi.fn() });

  expect(screen.getAllByRole('button')).toHaveLength(steps.length);
  screen.getByRole('navigation', { name: 'Build steps' });
});

test('disable navigation without a callback', async () => {
  render(Stepper, { value: 'output', steps });

  for (const button of screen.getAllByRole('button')) {
    expect(button).toBeDisabled();
  }
});

test.each(['Select image', '1'])('return to a previous step through %s', async name => {
  const onStepClick = vi.fn();
  render(Stepper, { value: 'output', steps, onStepClick });

  const target = name === '1' ? screen.getByText(name) : screen.getByRole('button', { name });
  await userEvent.click(target);

  expect(onStepClick).toHaveBeenCalledExactlyOnceWith(steps[0]);
  expect(screen.getByRole('button', { name: 'Output configuration' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Build' })).toBeEnabled();
});

test('select an available future step with its typed object', async () => {
  const onStepClick = vi.fn();
  render(Stepper, { value: 'image', steps, onStepClick });

  await userEvent.click(screen.getByRole('button', { name: 'Build' }));

  expect(onStepClick).toHaveBeenCalledExactlyOnceWith(steps[2]);
});
