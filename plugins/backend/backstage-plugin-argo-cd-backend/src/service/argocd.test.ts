import { getVoidLogger } from '@backstage/backend-common';
import { ConfigReader } from '@backstage/config';
import { ArgoService } from './argocd.service';
import {
  argocdCreateApplicationResp,
  argocdCreateProjectResp,
} from './argocdTestResponses';
import fetchMock from 'jest-fetch-mock';

const config = ConfigReader.fromConfigs([
  {
    context: '',
    data: {
      argocd: {
        appLocatorMethods: [
          {
            type: 'config',
            instances: [
              {
                name: 'argoInstance1',
                url: 'https://argoInstance1.com',
              },
            ],
          },
        ],
      },
    },
  },
]);

describe('ArgoCD service', () => {
  const argoService = new ArgoService('testusername', 'testpassword', config);

  beforeEach(() => {
    fetchMock.resetMocks();
  });

  it('should get argo app data', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        metadata: {
          name: 'testAppName',
          namespace: 'testNamespace',
        },
      }),
    );

    const resp = argoService.getArgoAppData(
      'https://argoInstance1.com',
      'argoInstance1',
      { name: 'testApp' },
      'testToken',
    );

    expect(await resp).toStrictEqual({
      instance: 'argoInstance1',
      metadata: {
        name: 'testAppName',
        namespace: 'testNamespace',
      },
    });
  });

  it('should fail to get argo app data', async () => {
    fetchMock.mockRejectOnce(new Error());

    await expect(
      argoService.getArgoAppData(
        'https://argoInstance1.com',
        'argoInstance1',
        { name: 'testApp' },
        'testToken',
      ),
    ).rejects.toThrow();
  });

  it('should return the argo instances an argo app is on', async () => {
    fetchMock.mockOnceIf(
      /.*\/api\/v1\/session/g,
      JSON.stringify({ token: 'testToken' }),
    );
    fetchMock.mockResponseOnce(
      JSON.stringify({
        metadata: {
          name: 'testApp-nonprod',
          namespace: 'argocd',
          status: {},
        },
      }),
    );

    const resp = argoService.findArgoApp({ name: 'testApp-nonprod' });

    expect(await resp).toStrictEqual([
      {
        name: 'argoInstance1',
        url: 'https://argoInstance1.com',
        appName: ['testApp-nonprod'],
      },
    ]);
  });

  it('should fail to return the argo instances an argo app is on', async () => {
    fetchMock.mockResponseOnce('', { status: 500 });
    return expect(async () => {
      await argoService.findArgoApp({ name: 'testApp' });
    }).rejects.toThrow();
  });

  it('should return the argo instances using the app selector', async () => {
    fetchMock.mockOnceIf(
      /.*\/api\/v1\/session/g,
      JSON.stringify({ token: 'testToken' }),
    );
    fetchMock.mockResponseOnce(
      JSON.stringify({
        items: [
          {
            metadata: {
              name: 'testApp-nonprod',
              namespace: 'argocd',
              status: {},
            },
          },
        ],
      }),
    );

    const resp = argoService.findArgoApp({ selector: 'name=testApp-nonprod' });

    expect(await resp).toStrictEqual([
      {
        appName: ['testApp-nonprod'],
        name: 'argoInstance1',
        url: 'https://argoInstance1.com',
      },
    ]);
  });

  it('should successfully decorate the items when using the app selector', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        items: [
          {
            metadata: {
              name: 'testApp-prod',
              namespace: 'argocd',
            },
          },
          {
            metadata: {
              name: 'testApp-staging',
              namespace: 'argocd',
            },
          },
        ],
      }),
    );

    const resp = argoService.getArgoAppData(
      'https://argoInstance1.com',
      'argoInstance1',
      { selector: 'service=testApp' },
      'testToken',
    );

    expect(await resp).toStrictEqual({
      items: [
        {
          metadata: {
            instance: {
              name: 'argoInstance1',
            },
            name: 'testApp-prod',
            namespace: 'argocd',
          },
        },
        {
          metadata: {
            instance: {
              name: 'argoInstance1',
            },
            name: 'testApp-staging',
            namespace: 'argocd',
          },
        },
      ],
    });
  });

  it('should create a project in argo', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        argocdCreateProjectResp,
      }),
    );

    const resp = argoService.createArgoProject({
      baseUrl: 'https://argoInstance1.com',
      argoToken: 'testToken',
      projectName: 'testProject',
      namespace: 'test-namespace',
      sourceRepo: 'https://github.com/backstage/backstage',
    });

    expect(await resp).toStrictEqual({
      argocdCreateProjectResp,
    });
  });

  it('should fail to create a project in argo when argo errors out', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        error: 'Failed to Create project',
      }),
    );

    const resp = argoService.createArgoProject({
      baseUrl: 'https://argoInstance1.com',
      argoToken: 'testToken',
      projectName: 'testProject',
      namespace: 'test-namespace',
      sourceRepo: 'https://github.com/backstage/backstage',
    });

    expect(await resp).toStrictEqual({
      error: 'Failed to Create project',
    });
  });

  it('should fail to create a project in argo when argo user is not given enough permissions', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        response: {
          status: 403,
          error:
            'permission denied: projects, create, backstagetestmanual2, sub: testuser18471, iat: 2022-04-13T12:28:34Z',
          message:
            'permission denied: projects, create, backstagetestmanual2, sub: testuser18471, iat: 2022-04-13T12:28:34Z',
        },
      }),
    );

    const resp = await argoService.createArgoProject({
      baseUrl: 'https://argoInstance1.com',
      argoToken: 'testToken',
      projectName: 'testProject',
      namespace: 'test-namespace',
      sourceRepo: 'https://github.com/backstage/backstage',
    });

    expect(resp).toStrictEqual({
      response: {
        error:
          'permission denied: projects, create, backstagetestmanual2, sub: testuser18471, iat: 2022-04-13T12:28:34Z',
        message:
          'permission denied: projects, create, backstagetestmanual2, sub: testuser18471, iat: 2022-04-13T12:28:34Z',
        status: 403,
      },
    });
  });

  it('should create an app in argo', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        argocdCreateApplicationResp,
      }),
    );

    const resp = argoService.createArgoApplication({
      baseUrl: 'https://argoInstance1.com',
      argoToken: 'testToken',
      appName: 'testProject',
      projectName: 'testProject',
      namespace: 'test-namespace',
      sourceRepo: 'https://github.com/backstage/backstage',
      sourcePath: 'kubernetes/nonproduction',
      labelValue: 'backstageId',
    });

    expect(await resp).toStrictEqual({
      argocdCreateApplicationResp,
    });
  });

  it('should fail to create an app in argo when argo errors out', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        error: 'Failed to Create application',
      }),
    );

    const resp = argoService.createArgoApplication({
      baseUrl: 'https://argoInstance1.com',
      argoToken: 'testToken',
      appName: 'testProject',
      projectName: 'testProject',
      namespace: 'test-namespace',
      sourceRepo: 'https://github.com/backstage/backstage',
      sourcePath: 'kubernetes/nonproduction',
      labelValue: 'backstageId',
    });

    expect(await resp).toStrictEqual({
      error: 'Failed to Create application',
    });
  });

  it('should fail to create a application in argo when argo user is not given enough permissions', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        response: {
          status: 403,
          error:
            'permission denied: applications, create, backstagetestmanual2/backstagetestmanual2, sub: testuser18471, iat: 2022-04-13T12:28:34Z',
          message:
            'permission denied: applications, create, backstagetestmanual2/backstagetestmanual2, sub: testuser18471, iat: 2022-04-13T12:28:34Z',
        },
      }),
    );

    const resp = await argoService.createArgoApplication({
      baseUrl: 'https://argoInstance1.com',
      argoToken: 'testToken',
      appName: 'testProject',
      projectName: 'testProject',
      namespace: 'test-namespace',
      sourceRepo: 'https://github.com/backstage/backstage',
      sourcePath: 'kubernetes/nonproduction',
      labelValue: 'backstageId',
    });

    expect(resp).toStrictEqual({
      response: {
        status: 403,
        error:
          'permission denied: applications, create, backstagetestmanual2/backstagetestmanual2, sub: testuser18471, iat: 2022-04-13T12:28:34Z',
        message:
          'permission denied: applications, create, backstagetestmanual2/backstagetestmanual2, sub: testuser18471, iat: 2022-04-13T12:28:34Z',
      },
    });
  });

  it('should create both app and project in argo', async () => {
    fetchMock.mockOnceIf(
      /.*\/api\/v1\/session/g,
      JSON.stringify({ token: 'testToken' }),
    );
    fetchMock.mockResponseOnce(
      JSON.stringify({
        argocdCreateApplicationResp,
      }),
    );
    fetchMock.mockResponseOnce(
      JSON.stringify({
        argocdCreateApplicationResp,
      }),
    );

    const resp = argoService.createArgoResources({
      argoInstance: 'argoInstance1',
      appName: 'testApp',
      projectName: 'testProject',
      namespace: 'testNamespace',
      sourceRepo: 'https://github.com/backstage/backstage',
      sourcePath: 'kubernetes/nonproduction',
      labelValue: 'backstageId',
      logger: getVoidLogger(),
    });

    expect(await resp).toStrictEqual(true);
  });

  it('should fail to create both app and project in argo when argo rejects', async () => {
    fetchMock.mockOnceIf(
      /.*\/api\/v1\/session/g,
      JSON.stringify({ token: 'testToken' }),
    );
    fetchMock.mockResponseOnce(
      JSON.stringify({
        error: 'Failure to create project',
      }),
    );

    const resp = argoService.createArgoResources({
      argoInstance: 'argoInstance1',
      appName: 'testApp',
      projectName: 'testProject',
      namespace: 'testNamespace',
      sourceRepo: 'https://github.com/backstage/backstage',
      sourcePath: 'kubernetes/nonproduction',
      labelValue: 'backstageId',
      logger: getVoidLogger(),
    });

    await expect(resp).rejects.toThrow();
  });

  it('should delete project in argo', async () => {
    fetchMock.mockResponseOnce('');

    const resp = argoService.deleteProject({
      baseUrl: 'https://argoInstance1.com',
      argoProjectName: 'testApp',
      argoToken: 'testToken',
    });

    expect(await resp).toStrictEqual(true);
  });

  it('should fail to delete project in argo when bad status', async () => {
    fetchMock.mockResponseOnce('', { status: 500 });

    const resp = argoService.deleteProject({
      baseUrl: 'https://argoInstance1.com',
      argoProjectName: 'testApp',
      argoToken: 'testToken',
    });

    expect(await resp).toStrictEqual(false);
  });

  it('should fail to delete project in argo when bad permissions', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        error:
          'permission denied: projects, delete, backstagetestmanual, sub: testuser18471, iat: 2022-04-13T12:28:34Z',
        message:
          'permission denied: projects, delete, backstagetestmanual, sub: testuser18471, iat: 2022-04-13T12:28:34Z',
      }),
      { status: 403 },
    );

    const resp = argoService.deleteProject({
      baseUrl: 'https://argoInstance1.com',
      argoProjectName: 'testApp',
      argoToken: 'testToken',
    });

    await expect(resp).rejects.toThrowError(
      'permission denied: projects, delete, backstagetestmanual, sub: testuser18471, iat: 2022-04-13T12:28:34Z',
    );
  });

  it('should delete app in argo', async () => {
    fetchMock.mockResponseOnce('');

    const resp = argoService.deleteApp({
      baseUrl: 'https://argoInstance1.com',
      argoApplicationName: 'testApp',
      argoToken: 'testToken',
    });

    expect(await resp).toStrictEqual(true);
  });

  it('should fail to delete app in argo when bad status', async () => {
    fetchMock.mockResponseOnce('', { status: 500 });

    const resp = argoService.deleteApp({
      baseUrl: 'https://argoInstance1.com',
      argoApplicationName: 'testApp',
      argoToken: 'testToken',
    });

    expect(await resp).toStrictEqual(false);
  });

  it('should fail to delete application in argo when bad permissions', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        error:
          'permission denied: projects, delete, backstagetestmanual, sub: testuser18471, iat: 2022-04-13T12:28:34Z',
        message:
          'permission denied: projects, delete, backstagetestmanual, sub: testuser18471, iat: 2022-04-13T12:28:34Z',
      }),
      { status: 403 },
    );

    const resp = argoService.deleteApp({
      baseUrl: 'https://argoInstance1.com',
      argoApplicationName: 'testApp',
      argoToken: 'testToken',
    });

    await expect(resp).rejects.toThrowError(
      'permission denied: projects, delete, backstagetestmanual, sub: testuser18471, iat: 2022-04-13T12:28:34Z',
    );
  });

  it('should sync app', async () => {
    fetchMock.mockResponseOnce('');

    const resp = argoService.syncArgoApp({
      argoInstance: {
        name: 'testApp',
        url: 'https://argoInstance1.com',
        appName: ['testApp'],
      },
      argoToken: 'testToken',
      appName: 'testApp',
    });

    expect(await resp).toStrictEqual({
      message: 'Re-synced testApp on testApp',
      status: 'Success',
    });
  });

  it('should fail to sync app on bad status', async () => {
    fetchMock.mockResponseOnce('', { status: 500 });

    const resp = argoService.syncArgoApp({
      argoInstance: {
        name: 'testApp',
        url: 'https://argoInstance1.com',
        appName: ['testApp'],
      },
      argoToken: 'testToken',
      appName: 'testApp',
    });

    expect(await resp).toStrictEqual({
      message: 'Failed to resync testApp on testApp',
      status: 'Failure',
    });
  });

  it('should fail to sync app on selector and name null', async () => {
    const appSelector = '';
    await expect(
      argoService.resyncAppOnAllArgos({ appSelector }),
    ).rejects.toThrow();
  });

  it('should fail to sync app on bad permissions', async () => {
    fetchMock.mockResponseOnce('', { status: 403 });

    const resp = argoService.syncArgoApp({
      argoInstance: {
        name: 'testApp',
        url: 'https://argoInstance1.com',
        appName: ['testApp'],
      },
      argoToken: 'testToken',
      appName: 'testApp',
    });

    expect(await resp).toStrictEqual({
      message: 'Failed to resync testApp on testApp',
      status: 'Failure',
    });
  });

  it('should sync all apps', async () => {
    // token
    fetchMock.mockResponseOnce(
      JSON.stringify({
        token: 'testToken',
      }),
    );
    // findArgoApp
    fetchMock.mockResponseOnce(
      JSON.stringify({
        items: [
          {
            metadata: {
              name: 'testAppName',
              namespace: 'testNamespace',
            },
          },
        ],
      }),
    );
    // token
    fetchMock.mockResponseOnce(
      JSON.stringify({
        token: 'testToken',
      }),
    );
    // sync
    fetchMock.mockResponseOnce('');

    const resp = argoService.resyncAppOnAllArgos({ appSelector: 'testApp' });

    expect(await resp).toStrictEqual([
      [
        {
          message: 'Re-synced testAppName on argoInstance1',
          status: 'Success',
        },
      ],
    ]);
  });

  it('should fail to sync all apps when bad token', async () => {
    // token
    fetchMock.mockOnceIf(
      /.*\/api\/v1\/session/g,
      JSON.stringify({
        message: 'Unauthorized',
      }),
      { status: 401, statusText: 'Unauthorized' },
    );

    const resp = argoService.resyncAppOnAllArgos({ appSelector: 'testApp' });

    await expect(resp).rejects.toThrowError(
      'Getting unauthorized for Argo CD instance https://argoInstance1.com',
    );
  });

  it('should fail to sync all apps when bad permissions', async () => {
    fetchMock.mockResponseOnce('', { status: 403 });

    const resp = argoService.syncArgoApp({
      argoInstance: {
        name: 'testApp',
        url: 'https://argoInstance1.com',
        appName: ['testApp'],
      },
      argoToken: 'testToken',
      appName: 'testApp',
    });

    expect(await resp).toStrictEqual({
      message: 'Failed to resync testApp on testApp',
      status: 'Failure',
    });
  });

  it('should fail to sync all apps due to permissions', async () => {
    // token
    fetchMock.mockResponseOnce(
      JSON.stringify({
        token: 'testToken',
      }),
    );
    // findArgoApp
    fetchMock.mockResponseOnce(
      JSON.stringify({
        items: [
          {
            metadata: {
              name: 'testAppName',
              namespace: 'testNamespace',
            },
          },
        ],
      }),
    );
    // token
    fetchMock.mockResponseOnce(
      JSON.stringify({
        token: 'testToken',
      }),
    );
    // sync
    fetchMock.mockResponseOnce(
      JSON.stringify({
        error:
          'permission denied: applications, sync, backstagetestmanual-nonprod/backstagetestmanual-nonprod, sub: testuser18471, iat: 2022-04-13T12:28:34Z',
        message:
          'permission denied: applications, sync, backstagetestmanual-nonprod/backstagetestmanual-nonprod, sub: testuser18471, iat: 2022-04-13T12:28:34Z',
      }),
      { status: 403 },
    );

    const resp = argoService.resyncAppOnAllArgos({ appSelector: 'testApp' });

    expect(await resp).toStrictEqual([
      [
        {
          message: 'Failed to resync testAppName on argoInstance1',
          status: 'Failure',
        },
      ],
    ]);
  });
});
