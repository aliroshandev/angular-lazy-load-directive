import { Component, PLATFORM_ID, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LazyLoad } from './lazy-load';

class FakeObserver {
  static instances: FakeObserver[] = [];
  disconnected = false;

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeObserver.instances.push(this);
  }

  observe() {}

  disconnect() {
    this.disconnected = true;
  }

  enterViewport() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

class FakeImage {
  static instances: FakeImage[] = [];
  onload?: () => void;
  onerror?: () => void;
  src = '';

  constructor() {
    FakeImage.instances.push(this);
  }

  decode() {
    return Promise.resolve();
  }
}

@Component({
  imports: [LazyLoad],
  template: `
    <img
      [appLazyLoad]="url()"
      [placeholderSrc]="placeholder()"
      [errorSrc]="fallback()"
      [retryAttempts]="retries()"
      [retryDelay]="100"
      [loadTimeout]="5000"
      (imageLoaded)="loaded.push($event)"
      (imageError)="errors.push($event)"
    />
  `,
})
class Host {
  url = signal('https://example.com/photo.png');
  placeholder = signal<string | undefined>(undefined);
  fallback = signal<string | undefined>(undefined);
  retries = signal(0);
  loaded: string[] = [];
  errors: Error[] = [];
}

const lastImage = () => FakeImage.instances[FakeImage.instances.length - 1];
const lastObserver = () => FakeObserver.instances[FakeObserver.instances.length - 1];

describe('LazyLoad', () => {
  let fixture: ComponentFixture<Host>;
  let img: HTMLImageElement;

  const setup = (configure?: (host: Host) => void) => {
    fixture = TestBed.createComponent(Host);
    configure?.(fixture.componentInstance);
    fixture.detectChanges();
    img = fixture.nativeElement.querySelector('img');
  };

  const flush = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

  beforeEach(() => {
    vi.useFakeTimers();
    FakeObserver.instances = [];
    FakeImage.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.stubGlobal('Image', FakeImage);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not load the image until it enters the viewport', () => {
    setup((host) => host.placeholder.set('/placeholder.png'));

    expect(FakeImage.instances).toHaveLength(0);
    expect(img.getAttribute('src')).toBe('/placeholder.png');
    expect(img.classList).toContain('lazy-placeholder');
  });

  it('shows the image and emits once it has loaded', async () => {
    setup((host) => host.placeholder.set('/placeholder.png'));

    lastObserver().enterViewport();
    expect(lastImage().src).toBe('https://example.com/photo.png');
    lastImage().onload!();
    await flush();

    expect(img.getAttribute('src')).toBe('https://example.com/photo.png');
    expect(img.classList).toContain('lazy-loaded');
    expect(img.classList).not.toContain('lazy-placeholder');
    expect(fixture.componentInstance.loaded).toEqual(['https://example.com/photo.png']);
    expect(lastObserver().disconnected).toBe(true);
  });

  it('retries a failed load, then shows the fallback and emits an error', async () => {
    setup((host) => {
      host.retries.set(1);
      host.fallback.set('/fallback.png');
    });

    lastObserver().enterViewport();
    lastImage().onerror!();
    await flush(100);
    expect(FakeImage.instances).toHaveLength(2);

    lastImage().onerror!();
    await flush(100);

    expect(FakeImage.instances).toHaveLength(2);
    expect(img.getAttribute('src')).toBe('/fallback.png');
    expect(fixture.componentInstance.errors).toHaveLength(1);
  });

  it('treats a load that passes the timeout as a failure', async () => {
    setup();

    lastObserver().enterViewport();
    await flush(5000);

    expect(fixture.componentInstance.errors[0].message).toContain('timeout');
  });

  it('does not retry or emit after the directive is destroyed', async () => {
    setup((host) => host.retries.set(3));

    lastObserver().enterViewport();
    fixture.destroy();
    await flush(1000);

    expect(FakeImage.instances).toHaveLength(1);
    expect(fixture.componentInstance.errors).toHaveLength(0);
  });

  it('does not reload after loading a relative URL', async () => {
    setup((host) => host.url.set('/photos/a.png'));

    lastObserver().enterViewport();
    lastImage().onload!();
    await flush();
    fixture.detectChanges();
    await flush();

    expect(FakeImage.instances).toHaveLength(1);
    expect(FakeObserver.instances).toHaveLength(1);
    expect(img.classList).toContain('lazy-loaded');
  });

  it('loads the new image when the URL input changes', async () => {
    setup();
    lastObserver().enterViewport();
    lastImage().onload!();
    await flush();

    fixture.componentInstance.url.set('https://example.com/other.png');
    fixture.detectChanges();
    lastObserver().enterViewport();
    lastImage().onload!();
    await flush();

    expect(img.getAttribute('src')).toBe('https://example.com/other.png');
    expect(fixture.componentInstance.loaded).toHaveLength(2);
  });

  it('loads straight away when IntersectionObserver is not available', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    setup();

    expect(FakeImage.instances).toHaveLength(1);
  });

  it('does not load during server rendering', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    setup((host) => host.placeholder.set('/placeholder.png'));

    expect(FakeImage.instances).toHaveLength(0);
    expect(FakeObserver.instances).toHaveLength(0);
    expect(img.getAttribute('src')).toBe('/placeholder.png');
    expect(img.getAttribute('data-lazy-src')).toBe('https://example.com/photo.png');
  });
});
