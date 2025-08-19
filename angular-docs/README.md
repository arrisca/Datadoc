# Angular 18 Docs App (Material + NgRx)

Production-ready docs shell with auto-registration of documentation pages.

Tech: Angular 18 (standalone), Angular Material, NgRx Store/Effects/Router-Store.

## Run locally

- Install deps: yarn
- Dev server: yarn start (opens http://localhost:4200)
- Build: yarn build

## Header config

Edit src/environments/environment.ts:
- logoUrl: image URL for the top-left logo
- headerLinks: URLs for Repository, Nexus, Cluster, Permission, Announcement, Help

## Add a new doc (auto-wired)

1) Generate a standalone component:
   ng g component docs/my-topic --standalone --inline-template --inline-style

2) Open the new component file and add a provider with doc metadata referencing the component class:

```ts
@Component({
  // ...
  providers: [{
    provide: DOCS,
    useValue: {
      id: 'my-topic',
      title: 'My Topic',
      section: 'My Section',
      order: 10,
      component: MyTopicComponent
    },
    multi: true
  }]
})
export class MyTopicComponent {}
```

That is it. The TOC entry, routing (/docs/my-topic), highlight, and Prev/Next arrows work automatically.

## Keyboard shortcuts
- Left Arrow or [: Previous doc
- Right Arrow or ]: Next doc

## Notes
- Change detection is OnPush everywhere for performance.
- TOC width persists (drag the vertical handle). Use the header left menu button to collapse/expand the TOC.
- A11y: aria-current on active TOC item, focus moves to doc heading on navigation.

Additional sample docs included:
- Configuration
- Validation
- Troubleshooting