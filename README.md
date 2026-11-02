# Angular Lazy Load Directive

[![CI](https://github.com/aliroshandev/angular-lazy-load-directive/actions/workflows/ci.yml/badge.svg)](https://github.com/aliroshandev/angular-lazy-load-directive/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/angular-lazy-load-directive.svg)](https://www.npmjs.com/package/angular-lazy-load-directive)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A small standalone Angular directive that loads an image when it enters the viewport. It's built with signals and IntersectionObserver, and has no dependencies beyond Angular and `tslib`.

[Live demo](https://angular-lazy-load-demo.netlify.app)

## Features

- Loads images only when they near the viewport
- Placeholder and fallback images
- Retries with a delay, plus a load timeout
- Safe during server rendering: nothing loads on the server
- Reloads when the URL input changes
- Works in zoneless applications

## Compatibility

| Package version | Angular |
|---|---|
| 22.x | 20.3 to 22 |

A package build was installed and compiled in new Angular 20, 21 and 22 applications. The unit tests run on Angular 22.

## Install

```bash
npm install angular-lazy-load-directive
```

## Usage

```ts
import { Component } from '@angular/core';
import { LazyLoad } from 'angular-lazy-load-directive';

@Component({
  selector: 'app-photo',
  imports: [LazyLoad],
  template: `
    <img
      [appLazyLoad]="'/photos/large.jpg'"
      placeholderSrc="/photos/placeholder.jpg"
      errorSrc="/photos/fallback.jpg"
      alt="Mountain lake at sunrise"
      (imageLoaded)="onLoaded($event)"
      (imageError)="onError($event)"
    />
  `,
})
export class PhotoComponent {
  onLoaded(url: string) {
    console.log('Loaded', url);
  }

  onError(error: Error) {
    console.error(error);
  }
}
```

Set `width` and `height` on the image, or size it with CSS, so the page doesn't shift when the image loads.

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `appLazyLoad` | `string` | required | Image URL |
| `placeholderSrc` | `string` | none | Shown until the image loads |
| `errorSrc` | `string` | none | Shown after all retries fail |
| `rootMargin` | `string` | `'50px'` | IntersectionObserver root margin |
| `threshold` | `number \| number[]` | `0.01` | IntersectionObserver threshold |
| `retryAttempts` | `number` | `3` | Retries after a failed load |
| `retryDelay` | `number` | `1000` | Milliseconds between retries |
| `loadTimeout` | `number` | `10000` | Milliseconds before a load counts as failed |

## Outputs

| Output | Type | Description |
|---|---|---|
| `imageLoaded` | `string` | Emits the URL after the image loads |
| `imageError` | `Error` | Emits after all retries fail |
| `loadingProgress` | `number` | Emits 0 at the start, 50 once the image can be decoded, and 100 when done. These are stages, not download progress |

## CSS classes

The directive adds these classes, so you can style transitions:

| Class | When |
|---|---|
| `lazy-placeholder` | The placeholder is showing |
| `lazy-loaded` | The image has loaded |
| `lazy-ssr` | The image was rendered on the server and is waiting for the browser |

## Server rendering

On the server, the directive sets the placeholder and stores the real URL in `data-lazy-src`. Loading starts in the browser.

## Limits

- It works on `<img>` elements only.
- If IntersectionObserver isn't available, the image loads straight away.
- It relies on the browser's image cache. A successful load fetches the image first, then sets `src`, so make sure your images can be cached or the browser may request them twice.
- For most pages, the browser's own `loading="lazy"` is simpler. Use this directive when you need placeholders, retries, a timeout or load events.

## Development

```bash
npm install
npm start          # run the demo at http://localhost:4200
npm test           # run the directive's unit tests
npm run build      # build the library into dist/lazy-load
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
