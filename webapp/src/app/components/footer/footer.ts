import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  imports: [CommonModule],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  @Input() subpageMode = false;
  @Input() hideSubpagePrimaryAction = false;

  @Output() pauseWorkflow = new EventEmitter<void>();
  @Output() previousTask = new EventEmitter<void>();
  @Output() nextTask = new EventEmitter<void>();
  @Output() closeSubpage = new EventEmitter<void>();
  @Output() saveAndCloseSubpage = new EventEmitter<void>();

  onPause(): void { this.pauseWorkflow.emit(); }
  onPrevious(): void { this.previousTask.emit(); }
  onNext(): void { this.nextTask.emit(); }
  onCloseSubpage(): void { this.closeSubpage.emit(); }
  onSaveAndCloseSubpage(): void { this.saveAndCloseSubpage.emit(); }
}
