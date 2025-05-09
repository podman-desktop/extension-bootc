/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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

import type * as extensionApi from '@podman-desktop/api';

/**
 * LoggerDelegator class implements the Logger interface and acts as a delegator for multiple Logger instances.
 * It allows to combine multiple loggers into a single logger and forwards log, error, and warn messages to each
 * individual logger in its internal list.
 *
 * This class addresses a specific use case where the new process API requires a single logger object, but we have
 * separate loggers and lifecycle contexts, where each lifecycle context also contains a logger object.
 * To accommodate this scenario, this adapter is created to hold multiple logger objects
 * and delegate method calls to each of them, providing a unified logger interface for the process API.
 *
 * If a similar use case arises in other extensions, it will be necessary to extend the RunOptions interface
 * by adding a new field called `lifecycleContext` that can hold a LifecycleContext instance.
 * Subsequently, the LoggerDelegator class can be removed, and the new RunOptions interface with the `lifecycleContext`
 * field can be used directly, simplifying the process of passing the logger to the process API while preserving
 * the necessary functionalities.
 */
export class LoggerDelegator implements extensionApi.Logger {
  private loggers: extensionApi.Logger[] = [];

  constructor(...loggersOrContexts: (extensionApi.Logger | extensionApi.LifecycleContext | undefined)[]) {
    loggersOrContexts.forEach(loggerOrContext => {
      if (loggerOrContext === undefined) {
        return;
      }
      if (typeof loggerOrContext.log === 'object') {
        this.loggers.push(loggerOrContext.log);
      } else if (typeof loggerOrContext.log === 'function') {
        this.loggers.push(loggerOrContext as extensionApi.Logger);
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(...data: any[]): void {
    this.loggers.forEach(logger => logger.log(...data));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error(...data: any[]): void {
    this.loggers.forEach(logger => logger.error(...data));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn(...data: any[]): void {
    this.loggers.forEach(logger => logger.warn(...data));
  }
}
