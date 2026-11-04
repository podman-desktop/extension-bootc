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

<script lang="ts" module>
export interface Step {
  id: string;
  label: string;
  disabled?: boolean;
}
</script>

<script lang="ts" generics="T extends Step">
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import Fa from 'svelte-fa';

interface Props {
  value: T['id'];
  steps: T[];
  onStepClick?: (step: T) => void;
}

let { value, steps, onStepClick }: Props = $props();
const id = $props.id();

const currentIndex = $derived(steps.findIndex(step => step.id === value));

function handleStepClick(step: T): void {
  if (isClickable(step)) {
    onStepClick?.(step);
  }
}

function isClickable(step: T): boolean {
  return step.id !== value && !step.disabled && !!onStepClick;
}
</script>

<nav aria-label="Build steps">
  <ol class="grid gap-2" style:grid-template-columns={`repeat(${steps.length}, minmax(0, 1fr))`}>
    {#each steps as step, index (step.id)}
      <li class="flex min-w-0 justify-center md:first:justify-start md:last:justify-end">
        <!-- The library Button does not forward aria-current or aria-describedby. -->
        <button
          type="button"
          class="flex w-full md:w-auto max-w-full flex-col md:flex-row items-center gap-2 px-3 py-2 rounded text-center md:text-left text-sm font-semibold enabled:cursor-pointer enabled:hover:bg-[var(--pd-button-link-hover-bg)] focus-visible:outline-2 focus-visible:outline-[var(--pd-button-focus-ring)] {value === step.id
            ? 'text-[var(--pd-button-link-text)]'
            : 'text-[var(--pd-content-card-text)]'}"
          aria-label={step.label}
          aria-current={value === step.id ? 'step' : undefined}
          aria-describedby={currentIndex > index ? `${id}-${step.id}-completed` : undefined}
          disabled={step.id !== value && !isClickable(step)}
          onclick={(): void => handleStepClick(step)}
          title={isClickable(step) ? `Go to ${step.label}` : undefined}>
          <span
            aria-hidden="true"
            class="flex shrink-0 items-center justify-center w-6 h-6 rounded-full border-2 text-xs font-bold {value === step.id
              ? 'border-[var(--pd-button-link-text)] bg-[var(--pd-button-link-text)] text-[var(--pd-content-card-bg)]'
              : currentIndex > index
                ? 'border-[var(--pd-state-success)] bg-[var(--pd-state-success)] text-[var(--pd-content-card-bg)]'
                : 'border-[var(--pd-content-card-text)] text-[var(--pd-content-card-text)]'}">
            {#if currentIndex > index}
              <Fa icon={faCheck} />
            {:else}
              {index + 1}
            {/if}
          </span>
          <span class="min-w-0 break-words">{step.label}</span>
          {#if currentIndex > index}
            <span id="{id}-{step.id}-completed" class="sr-only">Completed</span>
          {/if}
        </button>
      </li>
    {/each}
  </ol>
</nav>
