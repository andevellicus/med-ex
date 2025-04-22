import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ControlsSidebarComponent } from './controls-sidebar.component';

describe('ControlsSidebarComponent', () => {
  let component: ControlsSidebarComponent;
  let fixture: ComponentFixture<ControlsSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ControlsSidebarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ControlsSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
