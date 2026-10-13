import { App, Modal, TFile, Setting, Notice, ButtonComponent } from 'obsidian';

export interface NotePickerResult {
  title: string;
  files: TFile[];
}

export class NotePickerModal extends Modal {
  private selectedFiles: Set<TFile> = new Set();
  private projectTitle: string = 'My Obsidian Book';
  private onSubmit: (result: NotePickerResult) => void | Promise<void>;

  constructor(app: App, defaultTitle: string, onSubmit: (result: NotePickerResult) => void | Promise<void>) {
    super(app);
    this.projectTitle = defaultTitle || 'My Obsidian Book';
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Create physical book — select notes' });

    new Setting(contentEl)
      .setName('Book title')
      .setDesc('Enter a working title for this book project.')
      .addText((text) =>
        text.setValue(this.projectTitle).onChange((val) => {
          this.projectTitle = val;
        })
      );

    contentEl.createEl('h3', { text: 'Select notes from vault' });
    const listContainer = contentEl.createDiv({ cls: 'book-note-picker-list' });

    let createButton: ButtonComponent;
    const allMarkdownFiles = this.app.vault.getMarkdownFiles().sort((a, b) => a.path.localeCompare(b.path));

    allMarkdownFiles.forEach((file) => {
      const itemEl = listContainer.createEl('label', { cls: 'book-note-picker-item' });

      const checkbox = itemEl.createEl('input', { type: 'checkbox' });
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          this.selectedFiles.add(file);
        } else {
          this.selectedFiles.delete(file);
        }
        createButton.setDisabled(this.selectedFiles.size === 0);
      });

      itemEl.createSpan({ text: file.path });
    });

    new Setting(contentEl).addButton(btn => {
      createButton = btn;
      btn.setButtonText('Create book project').setCta().setDisabled(true).onClick(() => {
        if (!this.selectedFiles.size) return;
        this.close();
        void Promise.resolve(this.onSubmit({ title: this.projectTitle, files: Array.from(this.selectedFiles) }))
          .catch(e => new Notice(e instanceof Error ? e.message : String(e)));
      });
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
