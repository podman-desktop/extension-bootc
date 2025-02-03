/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
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

import { test, expect, vi, describe, beforeEach, afterEach } from 'vitest';
import { RpcBrowser, RpcExtension } from './MessageProxy';
import type { Webview } from '@podman-desktop/api';
import * as defaultNoTimeoutChannels from './NoTimeoutChannels';
import { getChannel } from './utils';

let webview: Webview;
let window: Window;
let api: PodmanDesktopApi;

vi.mock('./NoTimeoutChannels', async () => ({
  noTimeoutChannels: [],
}));

beforeEach(() => {
  let windowListener: (message: unknown) => void;
  let webviewListener: (message: unknown) => void;

  webview = {
    onDidReceiveMessage: (listener: (message: unknown) => void) => {
      webviewListener = listener;
    },
    postMessage: async (message: unknown): Promise<void> => {
      windowListener({ data: message } as MessageEvent);
    },
  } as unknown as Webview;

  window = {
    addEventListener: (channel: string, listener: (message: unknown) => void) => {
      expect(channel).toBe('message');
      windowListener = listener;
    },
  } as unknown as Window;

  api = {
    postMessage: (message: unknown) => {
      webviewListener(message);
    },
  } as unknown as PodmanDesktopApi;
});

test('init logic should be executing once', () => {
  vi.spyOn(webview, 'onDidReceiveMessage');
  const rpcExtension = new RpcExtension(webview);
  rpcExtension.init();

  expect(webview.onDidReceiveMessage).toHaveBeenCalledOnce();
});

test('Test register channel no argument', async () => {
  const rpcExtension = new RpcExtension(webview);
  rpcExtension.init();
  const rpcBrowser = new RpcBrowser(window, api);

  rpcExtension.register('ping', () => {
    return Promise.resolve('pong');
  });

  expect(await rpcBrowser.invoke('ping')).toBe('pong');
});

test('Test register channel one argument', async () => {
  const rpcExtension = new RpcExtension(webview);
  rpcExtension.init();
  const rpcBrowser = new RpcBrowser(window, api);

  rpcExtension.register('double', (value: number) => {
    return Promise.resolve(value * 2);
  });

  expect(await rpcBrowser.invoke('double', 4)).toBe(8);
});

test('Test register channel multiple arguments', async () => {
  const rpcExtension = new RpcExtension(webview);
  rpcExtension.init();
  const rpcBrowser = new RpcBrowser(window, api);

  rpcExtension.register('sum', (...args: number[]) => {
    return Promise.resolve(args.reduce((prev, current) => prev + current, 0));
  });

  expect(await rpcBrowser.invoke('sum', 1, 2, 3, 4, 5)).toBe(15);
});

test('Test register instance with async', async () => {
  class Dummy {
    static readonly CHANNEL: string = 'dummy';
    async ping(): Promise<string> {
      return 'pong';
    }
  }

  const rpcExtension = new RpcExtension(webview);
  rpcExtension.init();
  const rpcBrowser = new RpcBrowser(window, api);

  rpcExtension.registerInstance(Dummy, new Dummy());

  const proxy = rpcBrowser.getProxy<Dummy>(Dummy);
  expect(await proxy.ping()).toBe('pong');
});

test('Test register instance and implemented abstract classes', async () => {
  abstract class Foo {
    static readonly CHANNEL: string = 'dummy';
    abstract ping(): Promise<'pong'>;
  }

  class Dummy implements Foo {
    async ping(): Promise<'pong'> {
      return 'pong';
    }
  }

  const rpcExtension = new RpcExtension(webview);
  rpcExtension.init();
  const rpcBrowser = new RpcBrowser(window, api);

  rpcExtension.registerInstance(Foo, new Dummy());

  const proxy = rpcBrowser.getProxy<Foo>(Foo);
  expect(await proxy.ping()).toBe('pong');
});

test('Test register instance and extended abstract classes', async () => {
  abstract class Foo {
    static readonly CHANNEL: string = 'dummy';
    abstract ping(): Promise<'pong'>;
  }

  class Dummy extends Foo {
    override async ping(): Promise<'pong'> {
      return 'pong';
    }
  }

  const rpcExtension = new RpcExtension(webview);
  rpcExtension.init();
  const rpcBrowser = new RpcBrowser(window, api);

  rpcExtension.registerInstance(Foo, new Dummy());

  const proxy = rpcBrowser.getProxy<Foo>(Foo);
  expect(await proxy.ping()).toBe('pong');
});

test('Test raising exception', async () => {
  const rpcExtension = new RpcExtension(webview);
  rpcExtension.init();
  const rpcBrowser = new RpcBrowser(window, api);

  rpcExtension.register('raiseError', () => {
    throw new Error('big error');
  });

  await expect(rpcBrowser.invoke('raiseError')).rejects.toThrow('big error');
});

test('getChannel should use CHANNEL property of classType provided', () => {
  class Dummy {
    static readonly CHANNEL: string = 'dummy';
    async ping(): Promise<'pong'> {
      return new Promise(vi.fn());
    }
  }

  const channel = getChannel(Dummy, 'ping');
  expect(channel).toBe('dummy-ping');
});

describe('subscribe', () => {
  beforeEach(() => {
    window.addEventListener = vi.fn();

    (defaultNoTimeoutChannels.noTimeoutChannels as string[]) = [];
  });

  function getMessageListener(): (event: MessageEvent) => void {
    expect(window.addEventListener).toHaveBeenCalledOnce();
    expect(window.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    return vi.mocked(window.addEventListener).mock.calls[0][1] as (event: MessageEvent) => void;
  }

  test('subscriber should be called on event received', async () => {
    const rpcBrowser = new RpcBrowser(window, api);
    const messageListener = getMessageListener();

    const listener = vi.fn();
    rpcBrowser.subscribe('example', listener);

    messageListener({
      data: {
        id: 'example',
        body: 'hello',
      },
    } as unknown as MessageEvent);

    expect(listener).toHaveBeenCalledOnce();
  });

  test('all subscribers should be called if multiple exists', async () => {
    const rpcBrowser = new RpcBrowser(window, api);
    const messageListener = getMessageListener();

    const listeners = Array.from({ length: 10 }, _ => vi.fn());

    listeners.forEach(listener => rpcBrowser.subscribe('example', listener));

    messageListener({
      data: {
        id: 'example',
        body: 'hello',
      },
    } as unknown as MessageEvent);

    for (const listener of listeners) {
      expect(listener).toHaveBeenCalledWith('hello');
    }
  });

  test('subscribers which unsubscribe should not be called', async () => {
    const rpcBrowser = new RpcBrowser(window, api);
    const messageListener = getMessageListener();

    const [listenerA, listenerB] = [vi.fn(), vi.fn()];

    const unsubscriberA = rpcBrowser.subscribe('example', listenerA);
    const unsubscriberB = rpcBrowser.subscribe('example', listenerB);

    messageListener({
      data: {
        id: 'example',
        body: 'hello',
      },
    } as unknown as MessageEvent);

    // unsubscriber the listener B
    unsubscriberB.unsubscribe();

    messageListener({
      data: {
        id: 'example',
        body: 'hello',
      },
    } as unknown as MessageEvent);

    // unsubscriber the listener A
    unsubscriberA.unsubscribe();

    messageListener({
      data: {
        id: 'example',
        body: 'hello',
      },
    } as unknown as MessageEvent);

    expect(listenerA).toHaveBeenCalledTimes(2);
    expect(listenerB).toHaveBeenCalledOnce();
  });
});

describe('no timeout channel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();

    (defaultNoTimeoutChannels.noTimeoutChannels as string[]) = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('default function should have a timeout', async () => {
    class Dummy {
      static readonly CHANNEL: string = 'dummy';
      async ping(): Promise<'pong'> {
        return new Promise(vi.fn());
      }
    }

    const rpcExtension = new RpcExtension(webview);
    rpcExtension.init();
    const rpcBrowser = new RpcBrowser(window, api);

    rpcExtension.registerInstance(Dummy, new Dummy());

    const proxy = rpcBrowser.getProxy<Dummy>(Dummy);

    let error: Error | undefined;
    proxy.ping().catch((err: unknown) => {
      error = err as Error;
    });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(error?.message).toBe('Timeout');
  });

  test('noTimeoutChannels should not have a timeout', async () => {
    class Dummy {
      static readonly CHANNEL: string = 'dummy';
      async ping(): Promise<'pong'> {
        return new Promise(resolve => {
          setTimeout(resolve.bind(undefined, 'pong'), 8_000);
        });
      }
    }

    // fake the noTimeoutChannels
    (defaultNoTimeoutChannels.noTimeoutChannels as string[]) = [`${Dummy.CHANNEL}-ping`];

    const rpcExtension = new RpcExtension(webview);
    rpcExtension.init();
    const rpcBrowser = new RpcBrowser(window, api);

    rpcExtension.registerInstance(Dummy, new Dummy());

    const proxy = rpcBrowser.getProxy<Dummy>(Dummy);

    let error: Error | undefined;
    let result: 'pong' | undefined;
    proxy
      .ping()
      .then(mResult => {
        result = mResult;
      })
      .catch((err: unknown) => {
        error = err as Error;
      });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(error).toBeUndefined();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(error).toBeUndefined();
    expect(result).toBe('pong');
  });
});
