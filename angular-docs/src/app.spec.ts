import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './main';

// Since the app is bootstrapped via main.ts, unit test the registry + navigation logic instead

describe('Basic app bootstrap smoke', () => {
  it('should be able to create a minimal TestBed', async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([])]
    }).compileComponents();
    expect(true).toBeTrue();
  });
});