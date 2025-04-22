import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EntitiesSidebarComponent } from './entities-sidebar.component';

describe('EntitiesSidebarComponent', () => {
  let component: EntitiesSidebarComponent;
  let fixture: ComponentFixture<EntitiesSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntitiesSidebarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EntitiesSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
