/*
 * Copyright 2021 Larder Software Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { getVoidLogger } from '@backstage/backend-common';
import { createMergeJSONAction } from './merge';
import { PassThrough } from 'stream';
import mock from 'mock-fs';
import fs from 'fs-extra';

describe('roadiehq:utils:json:merge', () => {
  beforeEach(() => {
    mock({
      'fake-tmp-dir': {},
    });
  });
  afterEach(() => mock.restore());
  const mockContext = {
    workspacePath: 'lol',
    logger: getVoidLogger(),
    logStream: new PassThrough(),
    output: jest.fn(),
    createTemporaryDirectory: jest.fn(),
  };

  const action = createMergeJSONAction({});

  it('should throw error when required parameter path is not provided', async () => {
    await expect(
      action.handler({
        ...mockContext,
        input: { content: '' } as any,
      }),
    ).rejects.toThrow(/"path" argument must/);
  });

  it('should throw an error when the source file is not json', async () => {
    mock({
      'fake-tmp-dir': {
        'fake-file.json': 'not json',
      },
    });

    await expect(
      action.handler({
        ...mockContext,
        workspacePath: 'fake-tmp-dir',
        input: {
          path: 'fake-file.json',
          content: {
            foo: 'bar',
          },
        },
      }),
    ).rejects.toThrow(/Unexpected token/);
  });

  it('should write file to the workspacePath with the given content if it doesnt exist', async () => {
    await action.handler({
      ...mockContext,
      workspacePath: 'fake-tmp-dir',
      input: {
        path: 'fake-file.json',
        content: {
          foo: 'bar',
        },
      },
    });

    expect(fs.existsSync('fake-tmp-dir/fake-file.json')).toBe(true);
    const file = fs.readFileSync('fake-tmp-dir/fake-file.json', 'utf-8');
    expect(JSON.parse(file)).toEqual({ foo: 'bar' });
  });

  it('should append the content to the file if it already exists', async () => {
    mock({
      'fake-tmp-dir': {
        'fake-file.json': '{ "scripts": { "lsltr": "ls -ltr" } }',
      },
    });

    await action.handler({
      ...mockContext,
      workspacePath: 'fake-tmp-dir',
      input: {
        path: 'fake-file.json',
        content: {
          scripts: {
            lsltrh: 'ls -ltrh',
          },
        },
      },
    });

    expect(fs.existsSync('fake-tmp-dir/fake-file.json')).toBe(true);
    const file = fs.readFileSync('fake-tmp-dir/fake-file.json', 'utf-8');
    expect(JSON.parse(file)).toEqual({
      scripts: { lsltr: 'ls -ltr', lsltrh: 'ls -ltrh' },
    });
  });

  it('should put path on the output property', async () => {
    const ctx = {
      ...mockContext,
      workspacePath: 'fake-tmp-dir',
      input: {
        path: 'fake-file.json',
        content: {
          foo: 'bar',
        },
      },
    };
    await action.handler(ctx);

    expect(ctx.output.mock.calls[0][0]).toEqual('path');
    expect(ctx.output.mock.calls[0][1]).toContain(
      '/fake-tmp-dir/fake-file.json',
    );
  });
});
