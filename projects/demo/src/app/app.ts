import {Component, computed, effect, signal} from '@angular/core';
import {LazyLoad} from "../../../lazy-load/src/lib/directives/lazy-load";

interface ImageData {
  id: number;
  url: string;
  thumbnail?: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-root',
  imports: [LazyLoad],
  template: `
    <div class="container">
      <header>
        <h1>🚀 Angular 20 Lazy Load Directive</h1>
        <p>High-performance image loading with Signals</p>

        <div class="stats">
          <div class="stat-card">
            <span class="stat-value">{{ loadedImages() }}</span>
            <span class="stat-label">Loaded</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ totalImages() }}</span>
            <span class="stat-label">Total</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ loadPercentage() }}%</span>
            <span class="stat-label">Progress</span>
          </div>
        </div>

        <div class="actions">
          <button (click)="addMoreImages()" class="btn-primary">
            Add More Images
          </button>
          <button (click)="clearImages()" class="btn-secondary">
            Clear All
          </button>
          <button (click)="toggleImageSource()" class="btn-secondary">
            Source: {{ imageSource() }}
          </button>
        </div>
      </header>

      <div class="gallery">
        @for (image of images(); track image.id) {
          <div class="image-card" [class.loaded]="loadedImageIds().has(image.id)">
            <div class="image-wrapper">
              <img
                [appLazyLoad]="image.url"
                [placeholderSrc]="image.thumbnail || placeholderDataUrl"
                [errorSrc]="errorImageDataUrl"
                [retryAttempts]="3"
                [retryDelay]="1000"
                (imageLoaded)="onImageLoaded(image.id, $event)"
                (imageError)="onImageError(image.id, $event)"
                (loadingProgress)="onLoadingProgress(image.id, $event)"
                [alt]="image.description"
                width="400"
                height="300"
                loading="lazy">

              @if (loadingStates().get(image.id)) {
                <div class="loading-overlay">
                  <div class="progress-bar">
                    <div class="progress-fill"
                         [style.width.%]="loadingStates().get(image.id)">
                    </div>
                  </div>
                </div>
              }
            </div>

            <div class="image-info">
              <h3>{{ image.title }}</h3>
              <p>{{ image.description }}</p>
              @if (loadedImageIds().has(image.id)) {
                <span class="badge success">✓ Loaded</span>
              }
              @if (errorImageIds().has(image.id)) {
                <span class="badge error">✗ Error</span>
              }
            </div>
          </div>
        }
      </div>

      @if (images().length === 0) {
        <div class="empty-state">
          <p>No images to display</p>
          <button (click)="loadInitialImages()" class="btn-primary">
            Load Images
          </button>
        </div>
      }
    </div>`,
  styles: [`
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    header {
      text-align: center;
      margin-bottom: 3rem;
    }

    h1 {
      font-size: 3rem;
      margin-bottom: 0.5rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .stats {
      display: flex;
      gap: 2rem;
      justify-content: center;
      margin: 2rem 0;
    }

    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 1rem 2rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      color: #667eea;
    }

    .stat-label {
      font-size: 0.9rem;
      color: #666;
      margin-top: 0.25rem;
    }

    .actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    .btn-primary, .btn-secondary {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 1rem;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-secondary {
      background: #f5f5f5;
      color: #333;
    }

    .btn-secondary:hover {
      background: #e8e8e8;
    }

    .gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 2rem;
    }

    .image-card {
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
    }

    .image-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
    }

    .image-card.loaded {
      box-shadow: 0 4px 6px rgba(102, 126, 234, 0.2);
    }

    .image-wrapper {
      position: relative;
      width: 100%;
      height: 250px;
      overflow: hidden;
      background: #f8f8f8;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .lazy-placeholder {
      filter: blur(20px);
      transform: scale(1.1);
    }

    .lazy-loaded {
      animation: fadeIn 0.6s ease-in-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        filter: blur(10px);
      }
      to {
        opacity: 1;
        filter: blur(0);
      }
    }

    .loading-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(0, 0, 0, 0.5);
      padding: 0.5rem;
    }

    .progress-bar {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      transition: width 0.3s ease;
    }

    .image-info {
      padding: 1.5rem;
    }

    .image-info h3 {
      margin: 0 0 0.5rem 0;
      color: #333;
      font-size: 1.1rem;
    }

    .image-info p {
      margin: 0;
      color: #666;
      font-size: 0.9rem;
      line-height: 1.4;
    }

    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 600;
      margin-top: 0.5rem;
    }

    .badge.success {
      background: #d4edda;
      color: #155724;
    }

    .badge.error {
      background: #f8d7da;
      color: #721c24;
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: #666;
    }

    .empty-state p {
      font-size: 1.2rem;
      margin-bottom: 1.5rem;
    }

    @media (max-width: 768px) {
      .gallery {
        grid-template-columns: 1fr;
      }

      h1 {
        font-size: 2rem;
      }

      .stats {
        flex-direction: column;
        gap: 1rem;
      }
    }
  `]
})
export class App {
  // State signals
  images = signal<ImageData[]>([]);
  loadedImageIds = signal(new Set<number>());
  errorImageIds = signal(new Set<number>());
  loadingStates = signal(new Map<number, number>());
  imageSource = signal<'picsum' | 'placeholder' | 'unsplash'>('picsum');

  // Computed signals
  totalImages = computed(() => this.images().length);
  loadedImages = computed(() => this.loadedImageIds().size);
  loadPercentage = computed(() => {
    const total = this.totalImages();
    if (total === 0) return 0;
    return Math.round((this.loadedImages() / total) * 100);
  });

  // Data URLs for placeholder and error images
  readonly placeholderDataUrl = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3Ctext text-anchor="middle" x="200" y="150" fill="%23999" font-size="18" font-family="sans-serif"%3ELoading...%3C/text%3E%3C/svg%3E';

  readonly errorImageDataUrl = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23ffe0e0" width="400" height="300"/%3E%3Ctext text-anchor="middle" x="200" y="150" fill="%23cc0000" font-size="18" font-family="sans-serif"%3EError Loading Image%3C/text%3E%3C/svg%3E';

  constructor() {
    // Load initial images
    effect(() => {
      console.log(`Loaded ${this.loadedImages()} of ${this.totalImages()} images`);
    });

    this.loadInitialImages();
  }

  loadInitialImages() {
    const images = this.generateImages(12);
    this.images.set(images);
    this.resetLoadingState();
  }

  private generateImages(count: number): ImageData[] {
    const startId = this.images().length + 1;

    switch (this.imageSource()) {
      case 'picsum':
        return this.generatePicsumImages(count, startId);
      case 'placeholder':
        return this.generatePlaceholderImages(count, startId);
      case 'unsplash':
        return this.generateUnsplashImages(count, startId);
      default:
        return this.generatePicsumImages(count, startId);
    }
  }

  private generatePicsumImages(count: number, startId: number): ImageData[] {
    return Array.from({length: count}, (_, i) => {
      const imageId = 100 + startId + i; // Use stable IDs to avoid redirects
      return {
        id: startId + i,
        url: `https://picsum.photos/id/${imageId}/800/600`,
        thumbnail: `https://picsum.photos/id/${imageId}/80/60?blur=10`,
        title: `Picsum Image ${startId + i}`,
        description: `High-quality photograph from Lorem Picsum (#${imageId})`
      };
    });
  }

  private generatePlaceholderImages(count: number, startId: number): ImageData[] {
    const colors = ['3498db', 'e74c3c', '2ecc71', 'f39c12', '9b59b6'];

    return Array.from({length: count}, (_, i) => {
      const color = colors[i % colors.length];
      return {
        id: startId + i,
        url: `https://via.placeholder.com/800x600/${color}/ffffff?text=Image+${startId + i}`,
        thumbnail: `https://via.placeholder.com/80x60/${color}/ffffff?text=...`,
        title: `Placeholder ${startId + i}`,
        description: `Placeholder image with color #${color}`
      };
    });
  }

  private generateUnsplashImages(count: number, startId: number): ImageData[] {
    const topics = ['nature', 'architecture', 'technology', 'animals', 'food', 'travel'];

    return Array.from({length: count}, (_, i) => {
      const topic = topics[i % topics.length];
      return {
        id: startId + i,
        url: `https://source.unsplash.com/800x600/?${topic},${startId + i}`,
        title: `Unsplash ${topic} ${startId + i}`,
        description: `Beautiful ${topic} photography from Unsplash`
      };
    });
  }

  addMoreImages() {
    const newImages = this.generateImages(6);
    this.images.update(imgs => [...imgs, ...newImages]);
  }

  clearImages() {
    this.images.set([]);
    this.resetLoadingState();
  }

  toggleImageSource() {
    const sources: Array<'picsum' | 'placeholder' | 'unsplash'> = ['picsum', 'placeholder', 'unsplash'];
    const currentIndex = sources.indexOf(this.imageSource());
    const nextIndex = (currentIndex + 1) % sources.length;
    this.imageSource.set(sources[nextIndex]);

    // Reload images with new source
    this.clearImages();
    this.loadInitialImages();
  }

  private resetLoadingState() {
    this.loadedImageIds.set(new Set());
    this.errorImageIds.set(new Set());
    this.loadingStates.set(new Map());
  }

  onImageLoaded(imageId: number, imageUrl: string) {
    console.log(`Image ${imageId} loaded:`, imageUrl);
    this.loadedImageIds.update(ids => {
      const newIds = new Set(ids);
      newIds.add(imageId);
      return newIds;
    });

    // Remove from loading states
    this.loadingStates.update(states => {
      const newStates = new Map(states);
      newStates.delete(imageId);
      return newStates;
    });
  }

  onImageError(imageId: number, error: Error) {
    console.error(`Image ${imageId} error:`, error);
    this.errorImageIds.update(ids => {
      const newIds = new Set(ids);
      newIds.add(imageId);
      return newIds;
    });

    // Remove from loading states
    this.loadingStates.update(states => {
      const newStates = new Map(states);
      newStates.delete(imageId);
      return newStates;
    });
  }

  onLoadingProgress(imageId: number, progress: number) {
    this.loadingStates.update(states => {
      const newStates = new Map(states);
      newStates.set(imageId, progress);
      return newStates;
    });
  }
}
