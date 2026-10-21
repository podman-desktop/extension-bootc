<!--
 Copyright (C) 2026 Red Hat, Inc.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 SPDX-License-Identifier: Apache-2.0
-->

<script lang="ts">
import { Button } from '@podman-desktop/ui-svelte';

export interface Step {
  id: string;
  label: string;
}

interface Props {
  value: string;
  steps: Step[];
  onStepClick?: (stepId: string) => void;
}

let { value, steps, onStepClick }: Props = $props();

const currentIndex = $derived(steps.findIndex(step => step.id === value));

function handleStepClick(stepId: string, stepIndex: number): void {
  // Only completed steps support navigation.
  if (stepIndex < currentIndex && onStepClick) {
    onStepClick(stepId);
  }
}

function isClickable(stepIndex: number): boolean {
  return stepIndex < currentIndex && !!onStepClick;
}
</script>

<nav class="flex items-center" aria-label="Build steps">
  {#each steps as step, index (step.id)}
    <div aria-current={value === step.id ? 'step' : undefined}>
      <Button
        type="link"
        padding="p-0"
        class="flex items-center text-sm {value === step.id
          ? 'text-[var(--pd-button-primary-bg)] font-semibold'
          : 'text-[var(--pd-content-card-text)]'}"
        aria-label={step.label}
        disabled={!isClickable(index)}
        onclick={handleStepClick.bind(undefined, step.id, index)}
        title={isClickable(index) ? `Go back to ${step.label}` : ''}>
        <span
          aria-hidden="true"
          class="flex items-center justify-center w-6 h-6 rounded-full border-2 mr-2 text-xs font-bold {value === step.id
            ? 'border-[var(--pd-button-primary-bg)] bg-[var(--pd-button-primary-bg)] text-white'
            : currentIndex > index
              ? 'border-[var(--pd-state-success)] bg-[var(--pd-state-success)] text-white'
              : 'border-[var(--pd-content-card-border)] text-[var(--pd-content-card-text)]'}">
          {index + 1}
        </span>
        {step.label}
      </Button>
    </div>
    {#if index < steps.length - 1}
      <div class="grow mx-4 h-0.5 bg-[var(--pd-content-card-border)]"></div>
    {/if}
  {/each}
</nav>
