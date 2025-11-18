import {
  afterNextRender,
  Directive, effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  OutputEmitterRef,
  PLATFORM_ID,
  Renderer2, signal
} from '@angular/core';
import {isPlatformBrowser} from "@angular/common";

@Directive({
  selector: '[appLazyLoad]'
})
export class LazyLoad implements OnInit, OnDestroy {
  // Required input: Image URL
  appLazyLoad = input.required<string>();

  // Optional inputs with defaults
  placeholderSrc = input<string>();
  errorSrc = input<string>();
  rootMargin = input<string>('50px');
  threshold = input<number | number[]>(0.01);
  retryAttempts = input<number>(3);
  retryDelay = input<number>(1000);
  loadTimeout = input<number>(10000);

  // Outputs
  imageLoaded: OutputEmitterRef<string> = output<string>();
  imageError: OutputEmitterRef<Error> = output<Error>();
  loadingProgress: OutputEmitterRef<number> = output<number>();

  // Private state
  private observer?: IntersectionObserver;
  private readonly platformId = inject(PLATFORM_ID);
  private readonly el = inject(ElementRef<HTMLImageElement>);
  private readonly renderer = inject(Renderer2);

  private hasLoaded = signal(false);
  private isLoading = signal(false);
  private attempts = signal(0);
  private abortController?: AbortController;
  private timeoutId?: number;
  private loadListeners: (() => void)[] = [];

  constructor() {
    // Use effect to react to input changes
    effect(() => {
      const url = this.appLazyLoad();
      if (url && this.hasLoaded() && this.el.nativeElement.src !== url) {
        // Reset and reload if URL changes
        this.reset();
        this.setupObserver();
      }
    });

    // Browser-only initialization
    if (isPlatformBrowser(this.platformId)) {
      afterNextRender(() => {
        this.initBrowserFeatures();
      });
    }
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.initPlaceholder();
      this.setupObserver();
    } else {
      // SSR: Set placeholder or data attribute
      this.handleSSR();
    }
  }

  private handleSSR() {
    const img = this.el.nativeElement;

    // Set placeholder for SSR
    if (this.placeholderSrc()) {
      this.renderer.setAttribute(img, 'src', this.placeholderSrc()!);
    }

    // Store actual URL as data attribute for hydration
    this.renderer.setAttribute(img, 'data-lazy-src', this.appLazyLoad());
    this.renderer.addClass(img, 'lazy-ssr');
  }

  private initBrowserFeatures() {
    const img = this.el.nativeElement;

    // Check if we're hydrating from SSR
    const ssrUrl = img.getAttribute('data-lazy-src');
    if (ssrUrl && !this.hasLoaded()) {
      // Remove SSR class
      this.renderer.removeClass(img, 'lazy-ssr');
      // Re-setup with the SSR URL
      this.setupObserver();
    }
  }

  private initPlaceholder() {
    const img = this.el.nativeElement;

    // Set placeholder if provided and not already set
    if (this.placeholderSrc() && !img.src) {
      this.renderer.setAttribute(img, 'src', this.placeholderSrc()!);
      this.renderer.addClass(img, 'lazy-placeholder');
    }

    // Setup error handling
    this.setupErrorHandling();
  }

  private setupErrorHandling() {
    const img = this.el.nativeElement;

    // Remove any existing error listener
    this.clearListeners();

    const errorListener = this.renderer.listen(img, 'error', (event: Event) => {
      // Prevent infinite loop
      if (img.src === this.errorSrc()) return;

      if (this.attempts() < this.retryAttempts()) {
        this.attempts.update(a => a + 1);
        this.retryLoad();
      } else if (this.errorSrc()) {
        this.renderer.setAttribute(img, 'src', this.errorSrc()!);
        this.imageError.emit(new Error(`Failed to load image after ${this.attempts()} attempts: ${this.appLazyLoad()}`));
      }
    });

    this.loadListeners.push(errorListener);
  }

  private setupObserver() {
    // Only setup in browser with IntersectionObserver support
    if (!isPlatformBrowser(this.platformId) || typeof IntersectionObserver === 'undefined') {
      this.loadImage();
      return;
    }

    // Clean up any existing observer
    this.cleanupObserver();

    const options: IntersectionObserverInit = {
      rootMargin: this.rootMargin(),
      threshold: this.threshold()
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.hasLoaded() && !this.isLoading()) {
          this.loadImage();
          this.cleanupObserver();
        } else if (!entry.isIntersecting && this.isLoading() && !this.hasLoaded()) {
          // Cancel loading if element leaves viewport while loading
          this.cancelCurrentLoad();
        }
      });
    }, options);

    this.observer.observe(this.el.nativeElement);
  }

  private async loadImage() {
    if (this.hasLoaded() || this.isLoading()) return;

    this.isLoading.set(true);
    this.loadingProgress.emit(0);

    try {
      // Cancel any previous load attempt
      this.cancelCurrentLoad();

      // Create new abort controller
      if (typeof AbortController !== 'undefined') {
        this.abortController = new AbortController();
      }

      // For SSR compatibility, check if Image is available
      if (typeof Image !== 'undefined') {
        await this.loadWithImageObject();
      } else {
        // Fallback for SSR or environments without Image
        this.loadDirectly();
      }
    } catch (error) {
      this.handleLoadError(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private loadWithImageObject(): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = this.el.nativeElement;
      const testImg = new Image();

      // Setup timeout
      this.timeoutId = window.setTimeout(() => {
        testImg.src = '';
        reject(new Error('Image loading timeout'));
      }, this.loadTimeout());

      // Setup abort listener
      if (this.abortController) {
        this.abortController.signal.addEventListener('abort', () => {
          testImg.src = '';
          window.clearTimeout(this.timeoutId);
          reject(new Error('Image loading cancelled'));
        });
      }

      // Handle successful load
      testImg.onload = () => {
        window.clearTimeout(this.timeoutId);

        if (!this.abortController?.signal.aborted) {
          this.renderer.setAttribute(img, 'src', this.appLazyLoad());
          this.renderer.removeClass(img, 'lazy-placeholder');
          this.renderer.addClass(img, 'lazy-loaded');
          this.hasLoaded.set(true);
          this.loadingProgress.emit(100);
          this.imageLoaded.emit(this.appLazyLoad());
          resolve();
        }
      };

      // Handle error
      testImg.onerror = () => {
        window.clearTimeout(this.timeoutId);
        reject(new Error(`Failed to load image: ${this.appLazyLoad()}`));
      };

      // Track progress if possible
      if ('decode' in testImg) {
        testImg.decode().then(() => {
          this.loadingProgress.emit(50);
        }).catch(() => {
          // Ignore decode errors
        });
      }

      // Start loading
      testImg.src = this.appLazyLoad();
    });
  }

  private loadDirectly() {
    const img = this.el.nativeElement;
    this.renderer.setAttribute(img, 'src', this.appLazyLoad());
    this.renderer.removeClass(img, 'lazy-placeholder');
    this.renderer.addClass(img, 'lazy-loaded');
    this.hasLoaded.set(true);
    this.imageLoaded.emit(this.appLazyLoad());
  }

  private retryLoad() {
    this.timeoutId = window.setTimeout(() => {
      this.loadImage();
    }, this.retryDelay());
  }

  private handleLoadError(error: any) {
    const img = this.el.nativeElement;

    if (this.attempts() < this.retryAttempts()) {
      this.attempts.update(a => a + 1);
      console.warn(`Retry attempt ${this.attempts()} for ${this.appLazyLoad()}`);
      this.retryLoad();
    } else {
      if (this.errorSrc()) {
        this.renderer.setAttribute(img, 'src', this.errorSrc()!);
      }
      this.imageError.emit(error);
    }
  }

  private cancelCurrentLoad() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = undefined;
    }

    if (this.timeoutId) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }

  private reset() {
    this.hasLoaded.set(false);
    this.isLoading.set(false);
    this.attempts.set(0);
    this.cancelCurrentLoad();

    const img = this.el.nativeElement;
    this.renderer.removeClass(img, 'lazy-loaded');

    if (this.placeholderSrc()) {
      this.renderer.setAttribute(img, 'src', this.placeholderSrc()!);
      this.renderer.addClass(img, 'lazy-placeholder');
    }
  }

  private cleanupObserver() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
  }

  private clearListeners() {
    this.loadListeners.forEach(listener => listener());
    this.loadListeners = [];
  }

  ngOnDestroy() {
    this.cancelCurrentLoad();
    this.cleanupObserver();
    this.clearListeners();
  }

}
