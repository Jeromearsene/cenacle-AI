import { isPermissionAllowed } from '../src/main/permissions';
import { evalIn, expect, test, waitForServices } from './fixtures';

const main = { isMainFrame: true };
const frame = { isMainFrame: false };

test.describe('permission policy', () => {
  test('the microphone is allowed, the camera and screen capture are not', () => {
    expect(isPermissionAllowed({ permission: 'media', mediaTypes: ['audio'], ...main })).toBe(true);
    expect(isPermissionAllowed({ permission: 'media', mediaTypes: ['video'], ...main })).toBe(
      false
    );
    expect(
      isPermissionAllowed({ permission: 'media', mediaTypes: ['audio', 'video'], ...main })
    ).toBe(false);
    expect(isPermissionAllowed({ permission: 'media', ...main })).toBe(false);
    expect(isPermissionAllowed({ permission: 'display-capture', ...main })).toBe(false);
  });

  test('what a chat service needs is allowed', () => {
    for (const permission of [
      'notifications',
      'clipboard-sanitized-write',
      'clipboard-read',
      'fullscreen',
    ]) {
      expect(isPermissionAllowed({ permission, ...main }), permission).toBe(true);
    }
  });

  test('everything else is refused', () => {
    for (const permission of ['geolocation', 'midi', 'usb', 'serial', 'hid', 'idle-detection']) {
      expect(isPermissionAllowed({ permission, ...main }), permission).toBe(false);
    }
  });

  test('an embedded third-party frame gets neither notifications nor the microphone', () => {
    expect(isPermissionAllowed({ permission: 'notifications', ...frame })).toBe(false);
    expect(isPermissionAllowed({ permission: 'media', mediaTypes: ['audio'], ...frame })).toBe(
      false
    );
    expect(isPermissionAllowed({ permission: 'clipboard-sanitized-write', ...frame })).toBe(true);
  });
});

test.describe('permissions seen by a service page', () => {
  test('microphone and notifications granted, camera and location denied', async ({
    launch,
    service,
  }) => {
    const { app } = await launch();
    const [id] = await waitForServices(app, new URL(service.url).origin, 1);
    const state = (name: string) =>
      evalIn<string>(
        app,
        id as number,
        `navigator.permissions.query({ name: ${JSON.stringify(name)} }).then((r) => r.state)`
      );
    await expect.poll(() => state('microphone')).toBe('granted');
    await expect.poll(() => state('notifications')).toBe('granted');
    await expect.poll(() => state('camera')).toBe('denied');
    await expect.poll(() => state('geolocation')).toBe('denied');
  });
});
