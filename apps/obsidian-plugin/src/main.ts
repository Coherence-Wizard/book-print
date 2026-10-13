import { Plugin, Notice, TFile, Menu, Modal, normalizePath } from 'obsidian';
import {
  PluginSettings,
  BookProject,
} from '@book-print/shared';
import { BookPrintSettingsTab } from './settings/BookPrintSettingsTab.js';
import { NotePickerModal } from './ui/NotePickerModal.js';
import { decodePluginData } from './data.js';
import { BookSetupModal } from './views/BookSetupModal.js';

export default class BookPrintPlugin extends Plugin {
  pluginSettings!: PluginSettings;
  projects: BookProject[] = [];
  private modals = new Set<Modal>();
  private unloaded = false;
  private saving: Promise<void> = Promise.resolve();

  async onload() {
    await this.loadSettings();

    // 1. Register Ribbon Icon
    this.addRibbonIcon('book', 'Create physical book (6×9)', () => {
      void this.launchBookCreation().catch(e => new Notice(e instanceof Error ? e.message : String(e)));
    });

    // 2. Register Command Palette Item
    this.addCommand({
      id: 'resume-book-project',
      name: 'Resume saved book project',
      callback: () => {
        const project = this.projects.at(-1);
        if (project) this.openProject(structuredClone(project));
        else new Notice('No saved book project yet.');
      },
    });
    this.addCommand({
      id: 'create-physical-book',
      name: 'Create physical book',
      callback: () => {
        void this.launchBookCreation().catch(e => new Notice(e instanceof Error ? e.message : String(e)));
      },
    });

    // 3. Register File Explorer Right-Click Context Menu
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu: Menu, file) => {
        if (file instanceof TFile && file.extension === 'md') {
          menu.addItem((item) => {
            item
              .setTitle('Create physical book')
              .setIcon('book')
              .onClick(() => {
                void (async () => {
                const content = await this.app.vault.read(file);
                const project = this.createNewBookProject([file.path], content, file.basename);
                this.openProject(project);
                })().catch(e => new Notice(e instanceof Error ? e.message : String(e)));
              });
          });
        }
      })
    );

    // 4. Register Three-Dot Editor Menu
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu: Menu, _editor, view) => {
        if (view.file && view.file.extension === 'md') {
          const file = view.file;
          menu.addItem((item) => {
            item
              .setTitle('Create physical book')
              .setIcon('book')
              .onClick(() => {
                void (async () => {
                const content = await this.app.vault.read(file);
                const project = this.createNewBookProject([file.path], content, file.basename);
                this.openProject(project);
                })().catch(e => new Notice(e instanceof Error ? e.message : String(e)));
              });
          });
        }
      })
    );

    // 5. Register Plugin Settings Tab
    this.addSettingTab(new BookPrintSettingsTab(this.app, this));


  }

  onunload() {
    this.unloaded = true;
    for (const modal of this.modals) modal.close();
    this.modals.clear();
  }

  openModal(modal: Modal) {
    if (this.unloaded) return;
    const close = modal.onClose.bind(modal);
    modal.onClose = () => { this.modals.delete(modal); close(); };
    this.modals.add(modal);
    modal.open();
  }

  openProject(project: BookProject) {
    this.openModal(new BookSetupModal(this.app, this, project));
  }

  async loadSettings() {
    const data: unknown = await this.loadData();
    const loaded = decodePluginData(data);
    this.pluginSettings = loaded.settings;
    this.projects = loaded.projects;
  }

  async importLegacyData() {
    if (this.projects.length) throw new Error('Import is available only before creating projects in this installation. Existing projects have not been changed.');
    const path = normalizePath(`${this.app.vault.configDir}/plugins/book-print-obsidian/data.json`);
    if (!await this.app.vault.adapter.exists(path)) throw new Error('No earlier Book Print installation was found in this vault.');
    const data: unknown = JSON.parse(await this.app.vault.adapter.read(path));
    const loaded = decodePluginData(data);
    await this.saving;
    if (this.projects.length || this.modals.size) throw new Error('Close book windows and import before creating any projects.');
    await this.saveData(loaded);
    this.pluginSettings = loaded.settings;
    this.projects = loaded.projects;
    new Notice('Imported earlier settings and book projects. The earlier installation is unchanged.');
  }

  async saveSettings() {
    this.saving = this.saving.catch(() => {}).then(() => this.saveData({ settings: this.pluginSettings, projects: this.projects }));
    await this.saving;
  }
  async saveProject(project: BookProject) {
    project.updatedAt = new Date().toISOString();
    this.projects = this.projects.filter(p => p.id !== project.id);
    this.projects.push(structuredClone(project));
    await this.saveSettings();
  }

  private async launchBookCreation() {
    const activeFile = this.app.workspace.getActiveFile();

    if (activeFile && activeFile.extension === 'md') {
      // Launch from current note directly
      const content = await this.app.vault.read(activeFile);
      const project = this.createNewBookProject([activeFile.path], content, activeFile.basename);
      this.openProject(project);
    } else {
      // Launch note picker modal for multi-note / folder selection
      this.openModal(new NotePickerModal(this.app, 'My book', async (result) => {
        const contents: string[] = [];
        for (const file of result.files) {
          const fileText = await this.app.vault.read(file);
          contents.push(`# ${file.basename}\n\n${fileText}`);
        }
        const combinedManuscript = contents.join('\n\n///\n\n');
        const project = this.createNewBookProject(
          result.files.map((f) => f.path),
          combinedManuscript,
          result.title
        );
        this.openProject(project);
      }));
    }
  }

  private createNewBookProject(
    sourcePaths: string[],
    workingManuscript: string,
    title: string
  ): BookProject {
    const previous = [...this.projects].reverse().find(p => p.sourceNotePaths.length === sourcePaths.length && p.sourceNotePaths.every((path, i) => path === sourcePaths[i]));
    if (previous) return { ...structuredClone(previous), workingManuscript: sourcePaths.length === 1 ? workingManuscript : previous.workingManuscript };
    return {
      id: crypto.randomUUID(),
      title: title || 'Untitled Book',
      sourceNotePaths: sourcePaths,
      workingManuscript,
      metadata: {
        title: title || 'Untitled Book',
        author: this.pluginSettings.defaultAuthorName || 'Author Name',
        imprint: this.pluginSettings.defaultPublisherImprint || '',
        copyrightHolder: this.pluginSettings.defaultCopyrightHolder || this.pluginSettings.defaultAuthorName,
        copyrightYear: new Date().getFullYear(),
        copyrightNoticeText: this.pluginSettings.defaultCopyrightNotice || '',
        website: this.pluginSettings.defaultWebsite || '',
        publisherContact: this.pluginSettings.defaultPublisherContact || '',
        includeTitlePage: true,
        includeCopyrightPage: true,
      },
      coverConfig: {
        mode: 'generic',
        genericStyle: 'classic',
      },
      bindingPreference: 'paperback',
      quantity: 1,
      syncSourceNote: sourcePaths.length === 1,
      shippingAddress: this.pluginSettings.defaultShippingAddress ? structuredClone(this.pluginSettings.defaultShippingAddress) : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}
