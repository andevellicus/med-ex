import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // Needed for basic directives

// Import Material modules needed for the layout & buttons/icons
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip'; // For toggle button tooltips
import { AngularSplitModule} from 'angular-split'; 

// Import child components used in the template
import { ControlsSidebarComponent } from './components/controls-sidebar/controls-sidebar.component';
import { ResultsDisplayComponent } from './components/results-display/results-display.component'; // Import new component
import { EntitiesSidebarComponent } from './components/entities-sidebar/entities-sidebar.component'; // Import new component

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    // Angular Modules
    CommonModule,

    // Material Layout Modules
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule, 

    // Child Components
    ControlsSidebarComponent,
    ResultsDisplayComponent, 
    EntitiesSidebarComponent, 
    AngularSplitModule
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  // State for sidebar visibility
  isControlsSidebarOpen = true;
  isEntitiesSidebarOpen = true;

  isDarkMode = false; // Keep theme logic if desired

  constructor() {
    this.isDarkMode = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  ngOnInit(): void {
    document.body.classList.toggle('dark-theme', this.isDarkMode);
    // Optional: Listen for OS theme changes (same as before)
  }

  // Methods to toggle sidebars
  toggleControlsSidebar(): void {
    this.isControlsSidebarOpen = !this.isControlsSidebarOpen;
  }

  toggleEntitiesSidebar(): void {
    this.isEntitiesSidebarOpen = !this.isEntitiesSidebarOpen;
  }
}