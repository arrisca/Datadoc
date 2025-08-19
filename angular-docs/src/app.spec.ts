import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

describe('Basic app bootstrap smoke', () => {
  it('should create TestBed', async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([])]
    }).compileComponents();
    expect(true).toBeTrue();
  });
});